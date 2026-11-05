import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { getModules } from "@/lib/modules";
import { moduleAppliesTo } from "@/lib/module-catalog";
import { listVenueShareLinks } from "@/lib/venue";
import { SECTORS, isSectorKey } from "@/lib/sectors";
import { PanelShell } from "@/components/panel-shell";
import { ShareManager } from "./ShareManager";

export const dynamic = "force-dynamic";

// Paylaşım linkleri: çiftlerle müsaitlik takvimini kimlik bilgisi olmadan paylaşmak için.
export default async function SharePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/paylasim`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !tenant.sector || !isSectorKey(tenant.sector)) notFound();
  const modules = await getModules(db, tenantId);
  if (!moduleAppliesTo("venue_share", tenant.sector) || !modules.venue_share) notFound();
  const links = await listVenueShareLinks(db, tenantId);

  return (
    <PanelShell tenantId={tenantId} tenantName={tenant.name} sectorLabel={SECTORS[tenant.sector].label} current="paylasim" modules={modules} role={role} publicHref={`/randevu/${tenant.sector}/${tenantId}`} title="Paylaşım linkleri">
      <ShareManager tenantId={tenantId} initialLinks={links} />
    </PanelShell>
  );
}
