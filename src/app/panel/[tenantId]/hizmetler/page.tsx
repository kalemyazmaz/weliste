import { getModules } from "@/lib/modules";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { listServices } from "@/lib/workspace";
import { listProducts } from "@/lib/products";
import { PanelShell } from "@/components/panel-shell";
import { SECTORS, type SectorKey } from "@/lib/sectors";
import { ServiceCards } from "./ServiceCards";
import { ProductCards } from "./ProductCards";

export const dynamic = "force-dynamic";

// Hizmetler: müşterinin randevu alırken seçtiği hizmetler, süre ve fiyatlar.
export default async function ServicesPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/hizmetler`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  const tenant = await getTenant(db, tenantId);
  const modules = await getModules(db, tenantId);
  if (!tenant || !tenant.sector) notFound();
  const services = await listServices(db, tenantId);
  const products = await listProducts(db, tenantId);

  return (
    <PanelShell
      tenantId={tenantId}
      tenantName={tenant.name}
      sectorLabel={SECTORS[tenant.sector as SectorKey]?.label ?? null}
      current="hizmetler"
      modules={modules}
      role={role}
      publicHref={`/randevu/${tenant.sector}/${tenantId}`}
      title="Hizmetler"
    >
      <ServiceCards tenantId={tenantId} services={services} isOwner={role === "owner"} sector={tenant.sector} />
      {modules.products && <section style={{ display: "grid", gap: 14, marginTop: 8 }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Ürünler</h2>
        <ProductCards tenantId={tenantId} products={products} isOwner={role === "owner"} />
      </section>}
    </PanelShell>
  );
}
