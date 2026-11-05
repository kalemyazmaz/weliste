import { randomUUID } from "node:crypto";
import { Db, Queryable, withTenant } from "./db";
import { AppError } from "./errors";
import { audit, normalizePhone } from "./service";

// Kasa: gelir ve gider kayıtları. Sahip görür. Dönemler İstanbul saatine göre hesaplanır.
const TZ = "+03:00";
export type Donem = "bugun" | "hafta" | "ay" | "tumu";
export const DONEMLER: Donem[] = ["bugun", "hafta", "ay", "tumu"];
export type Sekme = "tumu" | "gelir" | "gider" | "personel";

const istanbulToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Istanbul" }).format(now);

// Dönemin başlangıcı (ISO). "tumu" için null.
export function periodStart(donem: Donem, now = new Date()): string | null {
  if (donem === "tumu") return null;
  const today = istanbulToday(now);
  if (donem === "bugun") return new Date(`${today}T00:00:00${TZ}`).toISOString();
  if (donem === "ay") return new Date(`${today.slice(0, 7)}-01T00:00:00${TZ}`).toISOString();
  // hafta: Pazartesi başlangıç (İstanbul gece yarısı, gün çıkarılarak)
  const midnight = new Date(`${today}T00:00:00${TZ}`).getTime();
  const weekday = (new Date(`${today}T12:00:00${TZ}`).getUTCDay() + 6) % 7;
  return new Date(midnight - weekday * 86400000).toISOString();
}

export async function nextReceiptNo(tx: Queryable, tenantId: string): Promise<string> {
  await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`ledger:${tenantId}`]);
  const r = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM ledger_entries WHERE tenant_id = $1", [tenantId]);
  return `SS-${String(Number(r.rows[0].n) + 1).padStart(4, "0")}`;
}

// Tamamlanan randevunun hizmet bedelini gelir olarak kaydeder (en fazla bir kez, fiyat > 0 ise).
export async function recordAppointmentIncome(tx: Queryable, tenantId: string, appointmentId: string): Promise<void> {
  const r = await tx.query<Record<string, unknown>>(
    `SELECT a.service_name, a.staff_id, COALESCE(s.price_tl, 0)::text AS price
     FROM appointments a LEFT JOIN services s ON s.id = a.service_id WHERE a.id = $1`,
    [appointmentId],
  );
  const row = r.rows[0];
  if (!row || Number(row.price) <= 0) return;
  const receipt = await nextReceiptNo(tx, tenantId);
  await tx.query(
    `INSERT INTO ledger_entries (id, tenant_id, kind, category, description, amount_tl, method, staff_id, appointment_id, receipt_no)
     VALUES ($1, $2, 'gelir', $3, 'Randevu tamamlandı', $4, 'nakit', $5, $6, $7)
     ON CONFLICT (appointment_id) WHERE kind = 'gelir' DO NOTHING`,
    [randomUUID(), tenantId, String(row.service_name).slice(0, 80), row.price, row.staff_id ?? null, appointmentId, receipt],
  );
}

export interface LedgerEntry {
  id: string; kind: "gelir" | "gider"; category: string; description: string; amountTl: number; method: string;
  staffName: string | null; staffId: string | null; receiptNo: string; occurredAt: string; appointmentId: string | null; customerPhone: string | null;
}

export interface LedgerView {
  entries: LedgerEntry[];
  summary: { income: number; expense: number; margin: number; net: number };
  categories: string[];
}

export async function listLedger(db: Db, tenantId: string, opts: { sekme?: Sekme; donem?: Donem; category?: string; q?: string; personelId?: string }, now = new Date()): Promise<LedgerView> {
  const donem = opts.donem && DONEMLER.includes(opts.donem) ? opts.donem : "bugun";
  const from = periodStart(donem, now);
  const category = opts.category?.trim() || null;
  const q = opts.q?.trim().toLocaleLowerCase("tr-TR") || null;
  const sekme = opts.sekme ?? "tumu";
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<Record<string, unknown>>(
      `SELECT e.id, e.kind, e.category, e.description, e.amount_tl::text AS amount, e.method, e.receipt_no,
              e.occurred_at, e.appointment_id, e.customer_phone, e.staff_id, s.name AS staff_name
       FROM ledger_entries e LEFT JOIN staff s ON s.id = e.staff_id
       WHERE ($1::timestamptz IS NULL OR e.occurred_at >= $1)
         AND ($2::text IS NULL OR e.category = $2)
         AND ($3::text IS NULL OR lower(e.category || ' ' || e.description || ' ' || e.receipt_no || ' ' || COALESCE(s.name, '')) LIKE '%' || $3 || '%')
       ORDER BY e.occurred_at DESC LIMIT 500`,
      [from, category, q],
    );
    const all = r.rows.map((x) => ({
      id: String(x.id),
      kind: x.kind as "gelir" | "gider",
      category: String(x.category),
      description: String(x.description),
      amountTl: Number(x.amount),
      method: String(x.method),
      staffName: x.staff_name ? String(x.staff_name) : null,
      staffId: x.staff_id ? String(x.staff_id) : null,
      receiptNo: String(x.receipt_no),
      occurredAt: new Date(x.occurred_at as string).toISOString(),
      appointmentId: x.appointment_id ? String(x.appointment_id) : null,
      customerPhone: x.customer_phone ? String(x.customer_phone) : null,
    }));
    const income = all.filter((e) => e.kind === "gelir").reduce((a, e) => a + e.amountTl, 0);
    const expense = all.filter((e) => e.kind === "gider").reduce((a, e) => a + e.amountTl, 0);
    const entries = all.filter((e) => sekme === "tumu" || (sekme === "gelir" && e.kind === "gelir") || (sekme === "gider" && e.kind === "gider") || (sekme === "personel" && e.staffId !== null && (!opts.personelId || e.staffId === opts.personelId)));
    const cats = await tx.query<{ c: string }>("SELECT DISTINCT category AS c FROM ledger_entries WHERE tenant_id = $1 ORDER BY 1 LIMIT 100", [tenantId]);
    return {
      entries,
      summary: { income, expense, margin: income > 0 ? (income - expense) / income : 0, net: income - expense },
      categories: cats.rows.map((c) => c.c),
    };
  });
}

const METHODS = ["nakit", "kart", "havale"] as const;

// Manuel kayıt: gelir veya gider. Birden çok kalem tek fiş altında yazılır (aynı fiş no).
// Kalem: { name, amountTl, serviceId? }. Tek kalemli eski biçim { category, amountTl } da desteklenir.
// Kayıtlar değiştirilemez ve silinemez; düzeltme için ters kayıt girilir.
export async function addLedgerEntry(db: Db, tenantId: string, raw: unknown, actor?: string): Promise<string> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const kind = b.kind;
  const method = typeof b.method === "string" ? b.method : "nakit";
  const staffId = typeof b.staffId === "string" && b.staffId ? b.staffId : null;
  const customerPhone = normalizePhone(b.customerPhone);
  const description = typeof b.description === "string" ? b.description.trim().slice(0, 300) : "";
  const occurred = typeof b.occurredAt === "string" && b.occurredAt ? new Date(`${b.occurredAt}T12:00:00${TZ}`) : new Date();
  const rawItems: unknown[] = Array.isArray(b.items) ? b.items : [{ name: b.category, amountTl: b.amountTl }];
  const bad: string[] = [];
  if (kind !== "gelir" && kind !== "gider") bad.push("kind");
  if (!(METHODS as readonly string[]).includes(method)) bad.push("method");
  if (Number.isNaN(occurred.getTime())) bad.push("occurredAt");
  if (rawItems.length === 0 || rawItems.length > 20) bad.push("items");
  const items = rawItems.map((it) => {
    const x = (it ?? {}) as Record<string, unknown>;
    const name = typeof x.name === "string" ? x.name.trim().slice(0, 80) : "";
    const amount = Number(x.amountTl);
    if (name.length < 1) bad.push("category");
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) bad.push("amountTl");
    const itemStaff = typeof x.staffId === "string" && x.staffId ? x.staffId : null;
    return { name, amount, staff: itemStaff ?? staffId };
  });
  if (bad.length) throw new AppError(422, "validation", [...new Set(bad)]);
  const ids: string[] = [];
  await withTenant(db, tenantId, async (tx) => {
    for (const sid of new Set(items.map((i) => i.staff).filter((x): x is string => Boolean(x)))) {
      const s = await tx.query("SELECT 1 FROM staff WHERE id = $1", [sid]);
      if (!s.rows.length) throw new AppError(422, "validation", ["staffId"]);
    }
    const receipt = await nextReceiptNo(tx, tenantId);
    for (const it of items) {
      const id = randomUUID();
      ids.push(id);
      await tx.query(
        `INSERT INTO ledger_entries (id, tenant_id, kind, category, description, amount_tl, method, staff_id, customer_phone, occurred_at, receipt_no)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id, tenantId, kind, it.name, description, it.amount, method, it.staff, customerPhone, occurred.toISOString(), receipt],
      );
    }
    await audit(tx, tenantId, actor, `ledger.${String(kind)}`, receipt, { items: items.length, total: items.reduce((a, i) => a + i.amount, 0) });
  });
  return ids[0];
}
