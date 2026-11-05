import { Db, withTenant } from "./db";
import { audit, getTenant } from "./service";
import { AppError } from "./errors";

import { MODULES, moduleAppliesTo, type ModuleKey, type Modules } from "./module-catalog";
export { MODULES };
export type { ModuleKey, Modules };

export function defaultModules(): Modules {
  return Object.fromEntries(MODULES.map((m) => [m.key, m.def])) as Modules;
}

// Etkin modüller: kiracının ayarı, platform yöneticisinin global kapatması ve paketin kapsamı birlikte belirler.
export async function getModules(db: Db, tenantId: string): Promise<Modules> {
  const m = defaultModules();
  const r = await withTenant(db, tenantId, async (tx) => {
    const p = await tx.query<{ modules: Record<string, unknown> | null }>("SELECT modules FROM tenant_profiles");
    const pk = await tx.query<{ modules: string[] }>("SELECT pk.modules FROM tenants t JOIN packages pk ON pk.id = t.plan WHERE t.id = $1", [tenantId]);
    return { stored: p.rows[0]?.modules ?? null, pkg: pk.rows[0]?.modules ?? null };
  });
  if (r.stored) for (const k of Object.keys(m) as ModuleKey[]) if (typeof r.stored[k] === "boolean") m[k] = r.stored[k] as boolean;
  const flags = await db.transaction((tx) => tx.query<{ key: string; enabled: boolean }>("SELECT key, enabled FROM module_flags"));
  for (const f of flags.rows) if (!f.enabled && f.key in m) m[f.key as ModuleKey] = false;
  if (r.pkg) for (const k of Object.keys(m) as ModuleKey[]) if (!r.pkg.includes(k)) m[k] = false;
  return m;
}

export async function saveModules(db: Db, tenantId: string, raw: unknown, actor?: string): Promise<Modules> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const tenant = await getTenant(db, tenantId);
  // Sektörde görünmeyen bir modül açılamaz.
  for (const k of Object.keys(input)) {
    const known = MODULES.some((m) => m.key === k);
    if (known && typeof input[k] === "boolean" && !moduleAppliesTo(k, tenant?.sector)) throw new AppError(422, "validation", [k]);
  }
  const current = await getModules(db, tenantId);
  for (const k of Object.keys(current) as ModuleKey[]) if (typeof input[k] === "boolean") current[k] = input[k] as boolean;
  await withTenant(db, tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO tenant_profiles (tenant_id, modules) VALUES ($1, $2::jsonb)
       ON CONFLICT (tenant_id) DO UPDATE SET modules = EXCLUDED.modules`,
      [tenantId, JSON.stringify(current)],
    );
    await audit(tx, tenantId, actor, "modules.save", tenantId, current);
  });
  return current;
}
