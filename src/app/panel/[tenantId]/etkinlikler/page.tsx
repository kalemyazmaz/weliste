import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { getModules } from "@/lib/modules";
import { moduleAppliesTo } from "@/lib/module-catalog";
import { listOrgEvents } from "@/lib/org";
import { SECTORS, isSectorKey } from "@/lib/sectors";
import { PanelShell } from "@/components/panel-shell";
import { EventsManager } from "./EventsManager";

export const dynamic = "force-dynamic";

// Etkinlik projeleri: liste, durum, görev ilerlemesi ve bütçe özeti.
export default async function EventsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/etkinlikler`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !tenant.sector || !isSectorKey(tenant.sector)) notFound();
  const modules = await getModules(db, tenantId);
  if (!moduleAppliesTo("org_events", tenant.sector) || !modules.org_events) notFound();
  const items = await listOrgEvents(db, tenantId);

  return (
    <PanelShell tenantId={tenantId} tenantName={tenant.name} sectorLabel={SECTORS[tenant.sector].label} current="etkinlikler" modules={modules} role={role} publicHref={`/randevu/${tenant.sector}/${tenantId}`} title="Etkinlik projeleri">
      <EventsManager tenantId={tenantId} initialItems={items} />
    </PanelShell>
  );
}
