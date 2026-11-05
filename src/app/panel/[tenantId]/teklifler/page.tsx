import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { getModules } from "@/lib/modules";
import { moduleAppliesTo } from "@/lib/module-catalog";
import { listVenueInquiries } from "@/lib/venue";
import { SECTORS, isSectorKey } from "@/lib/sectors";
import { PanelShell } from "@/components/panel-shell";
import { InquiryList } from "./InquiryList";


export const dynamic = "force-dynamic";

// Seanslı teklifler: düğün salonu gündüz / gece seansları.
export default async function InquiriesPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/teklifler`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !tenant.sector || !isSectorKey(tenant.sector)) notFound();
  const modules = await getModules(db, tenantId);
  if (!moduleAppliesTo("venue_inquiries", tenant.sector) || !modules.venue_inquiries) notFound();
  const items = await listVenueInquiries(db, tenantId);

  return (
    <PanelShell
      tenantId={tenantId}
      tenantName={tenant.name}
      sectorLabel={SECTORS[tenant.sector].label}
      current="teklifler"
      modules={modules}
      role={role}
      publicHref={`/randevu/${tenant.sector}/${tenantId}`}
      title="Teklif talepleri"
    >
      <InquiryList tenantId={tenantId} initialItems={items} />
    </PanelShell>
  );
}
