import { getDb } from "@/lib/db";
import { listAdminPackages } from "@/lib/admin";
import { PackageCards } from "./PackageCards";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const items = await listAdminPackages(getDb());
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Paketler</h1>
      <p style={{ margin: 0, color: "var(--muted)" }}>Her paketin adı, fiyatı ve dahil olduğu modüller. Bir modül pakette yoksa o paketteki işletmelerde görünmez.</p>
      <PackageCards items={items} />
    </div>
  );
}
