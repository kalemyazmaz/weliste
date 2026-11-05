import { getModules } from "@/lib/modules";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { listServices, listStaff } from "@/lib/workspace";
import { listProducts } from "@/lib/products";
import { listCustomers } from "@/lib/customers";
import { runDuePayroll } from "@/lib/payroll";
import { DONEMLER, listLedger, type Donem, type Sekme } from "@/lib/ledger";
import { isSectorKey, SECTORS } from "@/lib/sectors";
import { PanelShell } from "@/components/panel-shell";
import { KasaView } from "./KasaView";

export const dynamic = "force-dynamic";

// Kasa: gelir ve gider defteri. Yalnızca sahip görür.
export default async function KasaPage({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<{ sekme?: string; donem?: string; kategori?: string; q?: string; personel?: string }> }) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/kasa`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  if (role !== "owner") notFound();
  const tenant = await getTenant(db, tenantId);
  const modules = await getModules(db, tenantId);
  if (!modules.ledger) notFound();
  if (!tenant || !tenant.sector || !isSectorKey(tenant.sector)) notFound();

  // Vadesi gelen maaş ve prim ödemeleri kasaya yazılır (dönem başına bir kez).
  if (modules.payroll) await runDuePayroll(db, tenantId);
  const sekme = (["tumu", "gelir", "gider", "personel"] as Sekme[]).includes(sp.sekme as Sekme) ? (sp.sekme as Sekme) : "tumu";
  const donem = (DONEMLER as string[]).includes(sp.donem ?? "") ? (sp.donem as Donem) : "bugun";
  const view = await listLedger(db, tenantId, { sekme, donem, category: sp.kategori, q: sp.q, personelId: sp.personel });
  const staff = await listStaff(db, tenantId);
  const services = await listServices(db, tenantId);
  const products = modules.products ? await listProducts(db, tenantId) : [];
  const customers = (await listCustomers(db, tenantId)).map((c) => ({ phone: c.phone, name: c.name }));

  return (
    <PanelShell
      tenantId={tenantId}
      tenantName={tenant.name}
      sectorLabel={SECTORS[tenant.sector].label}
      current="kasa"
      modules={modules}
      role={role}
      publicHref={`/randevu/${tenant.sector}/${tenantId}`}
      title="Kasa"
    >
      <KasaView tenantId={tenantId} view={view} sekme={sekme} donem={donem} kategori={sp.kategori ?? ""} q={sp.q ?? ""} staff={staff.map((s) => ({ id: s.id, name: s.name }))} services={services} products={products} customers={customers} personel={sp.personel ?? ""} />
    </PanelShell>
  );
}
