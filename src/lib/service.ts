import { randomUUID } from "node:crypto";
import { Db, Queryable, withTenant } from "./db";
import { Tenant } from "./types";

// Ortak yardımcılar: denetim kaydı, telefon normalizasyonu, işletme ve üyelik okumaları.
// Tüm kiracı verisi erişimi withTenant üzerinden yapılır; RLS her ifadeye uygulanır.

type Row = Record<string, unknown>;

// Turkish mobile numbers only, normalized to 90XXXXXXXXXX (digits, no plus sign).
export function normalizePhone(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const digits = String(raw).replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `90${digits.slice(1)}` : digits;
  return /^90[5]\d{9}$/.test(normalized) ? normalized : null;
}

// Append-only audit trail. Written in the same transaction as the change it describes,
// so a change cannot be recorded without its audit line, or the reverse.
export async function audit(
  tx: Queryable,
  tenantId: string,
  actor: string | undefined,
  action: string,
  target: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await tx.query(
    "INSERT INTO audit_events (id, tenant_id, actor_user_id, action, target, detail) VALUES ($1, $2, $3, $4, $5, $6::jsonb)",
    [randomUUID(), tenantId, actor ?? null, action, target, JSON.stringify(detail)],
  );
}

export async function listAudit(db: Db, tenantId: string, limit = 100): Promise<Array<Record<string, unknown>>> {
  return withTenant(db, tenantId, async (tx) => {
    const res = await tx.query(
      `SELECT id, actor_user_id, action, target, detail, created_at::text AS created_at
       FROM audit_events ORDER BY created_at DESC LIMIT $1`,
      [Math.min(Math.max(limit, 1), 500)],
    );
    return res.rows;
  });
}

export async function getTenant(db: Db, tenantId: string): Promise<Tenant | null> {
  const res = await db.transaction((tx) =>
    tx.query<Row>("SELECT id, name, city, plan, sector FROM tenants WHERE id = $1", [tenantId]),
  );
  const r = res.rows[0];
  return r
    ? { id: String(r.id), name: String(r.name), city: String(r.city), plan: r.plan as Tenant["plan"], sector: r.sector ? String(r.sector) : null }
    : null;
}

export async function userTenants(db: Db, userId: string): Promise<Array<{ id: string; name: string; city: string; role: string }>> {
  const res = await db.transaction((tx) =>
    tx.query<{ id: string; name: string; city: string; role: string }>(
      `SELECT t.id, t.name, t.city, m.role FROM memberships m JOIN tenants t ON t.id = m.tenant_id
       WHERE m.user_id = $1 ORDER BY t.name`,
      [userId],
    ),
  );
  return res.rows;
}
