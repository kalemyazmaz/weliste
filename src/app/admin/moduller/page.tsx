import { getDb } from "@/lib/db";
import { listAdminModules } from "@/lib/admin";
import { ModuleFlags } from "./ModuleFlags";

export const dynamic = "force-dynamic";

export default async function ModulesPage() {
  const items = await listAdminModules(getDb());
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Modüller</h1>
      <p style={{ margin: 0, color: "var(--muted)" }}>Kapalı bir modül tüm firmalarda gizlenir; verileri silinmez. Hangi paketlerde olduğu Paketler sayfasında belirlenir.</p>
      <ModuleFlags items={items} />
    </div>
  );
}
