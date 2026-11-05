import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { getModules } from "@/lib/modules";
import { moduleAppliesTo } from "@/lib/module-catalog";
import { listVenueSuppliers } from "@/lib/venue";
import { SECTORS, isSectorKey } from "@/lib/sectors";
import { PanelShell } from "@/components/panel-shell";
import { SupplierManager } from "./SupplierManager";

export const dynamic = "force-dynamic";

// Düğün tedarikçileri: müzik, fotoğraf, çiçek, yemek ve diğer.
export default async function SuppliersPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/tedarikci`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !tenant.sector || !isSectorKey(tenant.sector)) notFound();
  const modules = await getModules(db, tenantId);
  if (!moduleAppliesTo("venue_suppliers", tenant.sector) || !modules.venue_suppliers) notFound();
  const items = await listVenueSuppliers(db, tenantId);

  return (
    <PanelShell tenantId={tenantId} tenantName={tenant.name} sectorLabel={SECTORS[tenant.sector].label} current="tedarikci" modules={modules} role={role} publicHref={`/randevu/${tenant.sector}/${tenantId}`} title="Tedarikçiler">
      <SupplierManager tenantId={tenantId} initialItems={items} />
    </PanelShell>
  );
}
