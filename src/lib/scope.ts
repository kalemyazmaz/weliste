import { Db, withTenant } from "./db";

// Veri kapsamı. Sahip tüm randevuları ve müşterileri görür. Üye yalnızca kendi personel kaydına
// atanmış randevuları görür; personel kaydı yoksa hiçbir şey görmez.
export type Scope = { all: true } | { all: false; staffId: string | null };

export const ALL_SCOPE: Scope = { all: true };

export async function scopeFor(db: Db, tenantId: string, userId: string, role: string): Promise<Scope> {
  if (role === "owner") return ALL_SCOPE;
  const r = await withTenant(db, tenantId, (tx) => tx.query<{ id: string }>("SELECT id FROM staff WHERE user_id = $1", [userId]));
  return { all: false, staffId: r.rows[0] ? String(r.rows[0].id) : null };
}

// SQL parametreleri: [tümü mü, personel kimliği]. Kullanım: AND ($n::boolean OR staff_id = $m)
export const scopeArgs = (s: Scope): [boolean, string | null] => [s.all, s.all ? null : s.staffId];
