import { randomBytes } from "node:crypto";
import { createUser, requestPasswordReset } from "./auth";
import { Db, withTenant } from "./db";
import { AppError } from "./errors";
import { audit } from "./service";

// Ekip üyeleri. Yalnızca sahip ekleyebilir/çıkarabilir. Yeni üye, rastgele bir parolayla
// oluşturulur ve parola belirleme bağlantısı e-postayla gönderilir (parola kimseyle paylaşılmaz).

export interface MemberRow { userId: string; email: string; role: string }

export async function listMembers(db: Db, tenantId: string): Promise<MemberRow[]> {
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<{ user_id: string; email: string; role: string }>(
      `SELECT m.user_id, u.email, m.role FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.tenant_id = $1 ORDER BY m.role, u.email`,
      [tenantId],
    );
    return r.rows.map((x) => ({ userId: x.user_id, email: x.email, role: x.role }));
  });
}

export async function inviteMember(db: Db, tenantId: string, rawEmail: unknown, origin: string, actor: string): Promise<void> {
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(422, "validation", ["email"]);
  const existing = await db.transaction((tx) => tx.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]));
  let userId = existing.rows[0]?.id;
  if (!userId) {
    userId = await createUser(db, email, randomBytes(24).toString("base64url"));
  }
  await withTenant(db, tenantId, async (tx) => {
    const already = await tx.query("SELECT 1 FROM memberships WHERE tenant_id = $1 AND user_id = $2", [tenantId, userId]);
    if (already.rows.length) throw new AppError(409, "already_member");
    await tx.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'staff')", [tenantId, userId]);
    await audit(tx, tenantId, actor, "member.invite", userId, {});
  });
  await requestPasswordReset(db, email, origin);
}

export async function removeMember(db: Db, tenantId: string, userId: string, actor: string): Promise<void> {
  if (userId === actor) throw new AppError(422, "validation", ["userId"]);
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("SELECT role FROM memberships WHERE tenant_id = $1 AND user_id = $2", [tenantId, userId]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    if (r.rows[0].role === "owner") throw new AppError(422, "validation", ["userId"]);
    await tx.query("DELETE FROM memberships WHERE tenant_id = $1 AND user_id = $2", [tenantId, userId]);
    await audit(tx, tenantId, actor, "member.remove", userId, {});
  });
}
