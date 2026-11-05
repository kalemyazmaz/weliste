import { getModules } from "@/lib/modules";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { listStaff } from "@/lib/workspace";
import { listMembers } from "@/lib/members";
import { PanelShell } from "@/components/panel-shell";
import { SECTORS, type SectorKey } from "@/lib/sectors";
import { StaffCards } from "./StaffCards";
import { PayrollPlans } from "./PayrollPlans";
import { listPlans } from "@/lib/payroll";

export const dynamic = "force-dynamic";

// Personel: çalışanların kartları, aktiflik, unvan ve hesap bağlantısı.
export default async function StaffPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/personel`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  const tenant = await getTenant(db, tenantId);
  const modules = await getModules(db, tenantId);
  if (!tenant || !tenant.sector) notFound();
  const [staff, members] = await Promise.all([listStaff(db, tenantId), listMembers(db, tenantId)]);
  const plans = role === "owner" && modules.payroll ? await listPlans(db, tenantId) : [];

  return (
    <PanelShell
      tenantId={tenantId}
      tenantName={tenant.name}
      sectorLabel={SECTORS[tenant.sector as SectorKey]?.label ?? null}
      current="personel"
      modules={modules}
      role={role}
      publicHref={`/randevu/${tenant.sector}/${tenantId}`}
      title="Personel"
    >
      <StaffCards tenantId={tenantId} staff={staff} members={members} isOwner={role === "owner"} />
      {role === "owner" && modules.payroll && plans.length > 0 && (
        <section style={{ display: "grid", gap: 12, marginTop: 8 }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Maaş ve prim planları</h2>
          <PayrollPlans tenantId={tenantId} plans={plans} />
        </section>
      )}
    </PanelShell>
  );
}
