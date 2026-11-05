import { Db } from "./db";
import { AppError } from "./errors";
import { MODULES, type ModuleKey } from "./module-catalog";
import { currentUser } from "./auth";

// Platform yönetimi. Yalnız is_admin olan kullanıcılar; yönetici bayrağı veritabanında tutulur.
export async function requireAdmin(db: Db, token: string | null): Promise<{ id: string; email: string }> {
  const user = token ? await currentUser(db, token) : null;
  if (!user) throw new AppError(401, "unauthenticated");
  if (!user.isAdmin) throw new AppError(403, "forbidden");
  return { id: user.id, email: user.email };
}

export interface AdminUser { id: string; email: string; createdAt: string; isAdmin: boolean; disabled: boolean; tenantCount: number }

export async function listAdminUsers(db: Db): Promise<AdminUser[]> {
  const r = await db.transaction((tx) =>
    tx.query<Record<string, unknown>>(
      `SELECT u.id, u.email, u.created_at, u.is_admin, u.disabled,
              (SELECT count(*)::int FROM memberships m WHERE m.user_id = u.id) AS tenant_count
       FROM users u ORDER BY u.created_at DESC LIMIT 500`,
    ),
  );
  return r.rows.map((x) => ({
    id: String(x.id), email: String(x.email), createdAt: new Date(x.created_at as string).toISOString(),
    isAdmin: Boolean(x.is_admin), disabled: Boolean(x.disabled), tenantCount: Number(x.tenant_count),
  }));
}

// Kullanıcı bayrakları. Yönetici kendi yönetici yetkisini düşüremez veya kendini devre dışı bırakamaz.
export async function setAdminUserFlags(db: Db, actorId: string, userId: string, raw: unknown): Promise<void> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const isAdmin = typeof b.isAdmin === "boolean" ? b.isAdmin : undefined;
  const disabled = typeof b.disabled === "boolean" ? b.disabled : undefined;
  const bad: string[] = [];
  if (isAdmin === undefined && disabled === undefined) bad.push("isAdmin");
  if (bad.length) throw new AppError(422, "validation", bad);
  if (userId === actorId && (isAdmin === false || disabled === true)) throw new AppError(422, "validation", ["self"]);
  const r = await db.transaction((tx) =>
    tx.query("UPDATE users SET is_admin = COALESCE($2, is_admin), disabled = COALESCE($3, disabled) WHERE id = $1 RETURNING id", [userId, isAdmin ?? null, disabled ?? null]),
  );
  if (!r.rows.length) throw new AppError(404, "not_found");
  if (disabled === true) {
    // Devre dışı bırakılan kullanıcının açık oturumları kapatılır.
    await db.transaction((tx) => tx.query("DELETE FROM sessions WHERE user_id = $1", [userId]));
  }
}

export interface AdminPackage { id: string; name: string; priceTl: number; modules: string[]; active: boolean; tenantCount: number }

export async function listAdminPackages(db: Db): Promise<AdminPackage[]> {
  const r = await db.transaction((tx) =>
    tx.query<Record<string, unknown>>(
      `SELECT p.id, p.name, p.price_tl::float8 AS price, p.modules, p.active,
              (SELECT count(*)::int FROM tenants t WHERE t.plan = p.id) AS tenant_count
       FROM packages p ORDER BY p.sort`,
    ),
  );
  return r.rows.map((x) => ({
    id: String(x.id), name: String(x.name), priceTl: Number(x.price), modules: (x.modules as string[]) ?? [], active: Boolean(x.active), tenantCount: Number(x.tenant_count),
  }));
}

export async function saveAdminPackage(db: Db, id: string, raw: unknown): Promise<void> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const bad: string[] = [];
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 60) : "";
  if (name.length < 2) bad.push("name");
  const price = Number(b.priceTl);
  if (!Number.isFinite(price) || price < 0 || price > 1e7) bad.push("priceTl");
  const known = new Set<string>(MODULES.map((m) => m.key));
  const modules = Array.isArray(b.modules) && b.modules.every((x) => typeof x === "string" && known.has(x)) ? [...new Set(b.modules as string[])] : null;
  if (!modules) bad.push("modules");
  const active = typeof b.active === "boolean" ? b.active : undefined;
  if (bad.length) throw new AppError(422, "validation", bad);
  const r = await db.transaction((tx) =>
    tx.query("UPDATE packages SET name = $2, price_tl = $3, modules = $4::jsonb, active = COALESCE($5, active) WHERE id = $1 RETURNING id",
      [id, name, price, JSON.stringify(modules), active ?? null]),
  );
  if (!r.rows.length) throw new AppError(404, "not_found");
}

export interface AdminModule { key: ModuleKey; label: string; desc: string; sectors: string[]; enabled: boolean }

export async function listAdminModules(db: Db): Promise<AdminModule[]> {
  const flags = await db.transaction((tx) => tx.query<{ key: string; enabled: boolean }>("SELECT key, enabled FROM module_flags"));
  const map = new Map(flags.rows.map((f) => [f.key, f.enabled]));
  return MODULES.map((m) => ({ key: m.key, label: m.label, desc: m.desc, sectors: [...m.sectors], enabled: map.get(m.key) ?? true }));
}

export async function setAdminModule(db: Db, key: string, raw: unknown): Promise<void> {
  if (!MODULES.some((m) => m.key === key)) throw new AppError(404, "not_found");
  const enabled = (raw as Record<string, unknown> | null)?.enabled;
  if (typeof enabled !== "boolean") throw new AppError(422, "validation", ["enabled"]);
  await db.transaction((tx) =>
    tx.query("INSERT INTO module_flags (key, enabled) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET enabled = EXCLUDED.enabled", [key, enabled]),
  );
}
