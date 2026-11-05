import { getModules } from "@/lib/modules";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { listCustomers } from "@/lib/customers";
import { listStaff } from "@/lib/workspace";
import { scopeFor } from "@/lib/scope";
import { isSectorKey, SECTORS } from "@/lib/sectors";
import { PanelShell } from "@/components/panel-shell";
import { CustomersView } from "./CustomersView";

export const dynamic = "force-dynamic";

// Müşterilerim: özet, arama, müşteri kartları ve detay penceresi. Üye yalnızca kendi müşterilerini görür.
export default async function CustomersPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/musteriler`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  const tenant = await getTenant(db, tenantId);
  const modules = await getModules(db, tenantId);
  if (!tenant || !tenant.sector || !isSectorKey(tenant.sector)) notFound();

  const scope = await scopeFor(db, tenantId, user.id, role);
  const [customers, staff] = await Promise.all([listCustomers(db, tenantId, scope), listStaff(db, tenantId)]);
  const staffNames = Object.fromEntries(staff.map((s) => [s.id, s.name]));

  return (
    <PanelShell
      tenantId={tenantId}
      tenantName={tenant.name}
      sectorLabel={SECTORS[tenant.sector].label}
      current="musteriler"
      modules={modules}
      role={role}
      publicHref={`/randevu/${tenant.sector}/${tenantId}`}
      title="Müşterilerim"
    >
      <CustomersView tenantId={tenantId} customers={customers} staffNames={staffNames} isOwner={role === "owner"} notes={modules.notes} />
    </PanelShell>
  );
}
