import { randomUUID } from "node:crypto";
import { Db, Queryable, withTenant } from "./db";
import { AppError } from "./errors";
import { nextReceiptNo } from "./ledger";
import { audit } from "./service";

// Maaş ve prim planları. Her plan ve dönem için ödeme en fazla bir kez üretilir (payroll_runs).
// Maaş: ödeme gününde o ayın maaşı gider olarak yazılır.
// Prim: ödeme gününde, bir önceki ayın personele bağlı gelirinin yüzdesi gider olarak yazılır.
const TZ = "+03:00";

export interface PlanRow { staffId: string; name: string; monthlySalaryTl: number; primPercent: number; paymentDay: number; active: boolean; hasPlan: boolean }

export function istanbulParts(now: Date): { day: number; period: string } {
  const f = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Istanbul" });
  const [y, m, d] = f.format(now).split("-");
  return { day: Number(d), period: `${y}-${m}` };
}

export function prevPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function periodBounds(period: string): { from: string; to: string } {
  const [y, m] = period.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  const nextPeriod = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  return { from: new Date(`${period}-01T00:00:00${TZ}`).toISOString(), to: new Date(`${nextPeriod}-01T00:00:00${TZ}`).toISOString() };
}

export async function listPlans(db: Db, tenantId: string): Promise<PlanRow[]> {
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<Record<string, unknown>>(
      `SELECT s.id, s.name, p.monthly_salary_tl::text AS salary, p.prim_percent::text AS prim, p.payment_day, p.active
       FROM staff s LEFT JOIN payroll_plans p ON p.staff_id = s.id ORDER BY s.created_at`,
    );
    return r.rows.map((x) => ({
      staffId: String(x.id),
      name: String(x.name),
      monthlySalaryTl: Number(x.salary ?? 0),
      primPercent: Number(x.prim ?? 0),
      paymentDay: Number(x.payment_day ?? 1),
      active: x.payment_day === null || x.payment_day === undefined ? true : Boolean(x.active),
      hasPlan: x.payment_day !== null && x.payment_day !== undefined,
    }));
  });
}

export async function savePlan(db: Db, tenantId: string, staffId: string, raw: unknown, actor?: string): Promise<void> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const salary = Number(b.monthlySalaryTl ?? 0);
  const prim = Number(b.primPercent ?? 0);
  const day = Number(b.paymentDay ?? 1);
  const active = b.active !== false && b.active !== "false";
  const bad: string[] = [];
  if (!Number.isFinite(salary) || salary < 0 || salary > 1e8) bad.push("monthlySalaryTl");
  if (!Number.isFinite(prim) || prim < 0 || prim > 100) bad.push("primPercent");
  if (!Number.isInteger(day) || day < 1 || day > 28) bad.push("paymentDay");
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    const s = await tx.query("SELECT 1 FROM staff WHERE id = $1", [staffId]);
    if (!s.rows.length) throw new AppError(404, "not_found");
    await tx.query(
      `INSERT INTO payroll_plans (tenant_id, staff_id, monthly_salary_tl, prim_percent, payment_day, active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (tenant_id, staff_id) DO UPDATE SET monthly_salary_tl = EXCLUDED.monthly_salary_tl, prim_percent = EXCLUDED.prim_percent,
         payment_day = EXCLUDED.payment_day, active = EXCLUDED.active, updated_at = now()`,
      [tenantId, staffId, salary, prim, day, active],
    );
    await audit(tx, tenantId, actor, "payroll.plan", staffId, { salary, prim, day, active });
  });
}

async function insertExpense(tx: Queryable, tenantId: string, category: string, description: string, amount: number, staffId: string, period: string): Promise<string> {
  const id = randomUUID();
  const receipt = await nextReceiptNo(tx, tenantId);
  await tx.query(
    `INSERT INTO ledger_entries (id, tenant_id, kind, category, description, amount_tl, method, staff_id, occurred_at, receipt_no)
     VALUES ($1, $2, 'gider', $3, $4, $5, 'havale', $6, now(), $7)`,
    [id, tenantId, category, `${description} (${period})`, amount, staffId, receipt],
  );
  return id;
}

// Vadesi gelen maaş ve prim ödemelerini üretir. Her çağrı idempotenttir.
export async function runDuePayroll(db: Db, tenantId: string, now = new Date()): Promise<number> {
  const { day, period } = istanbulParts(now);
  const plans = await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<Record<string, unknown>>(
      "SELECT staff_id, monthly_salary_tl::text AS salary, prim_percent::text AS prim, payment_day FROM payroll_plans WHERE active",
    );
    return r.rows;
  });
  let created = 0;
  for (const p of plans) {
    if (day < Number(p.payment_day)) continue;
    const staffId = String(p.staff_id);
    const salary = Number(p.salary);
    const prim = Number(p.prim);
    // Maaş: bu dönem
    const salaryMade = await withTenant(db, tenantId, async (tx) => {
      const ins = await tx.query(
        "INSERT INTO payroll_runs (tenant_id, staff_id, period, kind, amount_tl) VALUES ($1, $2, $3, 'maas', $4) ON CONFLICT DO NOTHING RETURNING 1",
        [tenantId, staffId, period, salary],
      );
      if (!ins.rows.length || salary <= 0) return false;
      const ledgerId = await insertExpense(tx, tenantId, "Maaş", "Maaş", salary, staffId, period);
      await tx.query("UPDATE payroll_runs SET ledger_id = $5 WHERE tenant_id = $1 AND staff_id = $2 AND period = $3 AND kind = $4", [tenantId, staffId, period, "maas", ledgerId]);
      return true;
    });
    if (salaryMade) created++;
    // Prim: önceki dönemin personele bağlı geliri üzerinden
    if (prim > 0) {
      const pp = prevPeriod(period);
      const primMade = await withTenant(db, tenantId, async (tx) => {
        const ins = await tx.query(
          "INSERT INTO payroll_runs (tenant_id, staff_id, period, kind, amount_tl) VALUES ($1, $2, $3, 'prim', 0) ON CONFLICT DO NOTHING RETURNING 1",
          [tenantId, staffId, pp],
        );
        if (!ins.rows.length) return false;
        const { from, to } = periodBounds(pp);
        const sum = await tx.query<{ n: string }>(
          "SELECT COALESCE(SUM(amount_tl), 0)::text AS n FROM ledger_entries WHERE kind = 'gelir' AND staff_id = $1 AND occurred_at >= $2 AND occurred_at < $3",
          [staffId, from, to],
        );
        const amount = Math.round(Number(sum.rows[0].n) * prim) / 100;
        if (amount <= 0) return false;
        const ledgerId = await insertExpense(tx, tenantId, "Prim", "Prim", amount, staffId, pp);
        await tx.query("UPDATE payroll_runs SET amount_tl = $5, ledger_id = $6 WHERE tenant_id = $1 AND staff_id = $2 AND period = $3 AND kind = $4", [tenantId, staffId, pp, "prim", amount, ledgerId]);
        return true;
      });
      if (primMade) created++;
    }
  }
  return created;
}
