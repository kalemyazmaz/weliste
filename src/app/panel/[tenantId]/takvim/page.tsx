import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { getModules } from "@/lib/modules";
import { moduleAppliesTo } from "@/lib/module-catalog";
import { listVenueHalls, listVenueSessions } from "@/lib/venue";
import { SECTORS, isSectorKey } from "@/lib/sectors";
import { PanelShell } from "@/components/panel-shell";
import { VenueCalendar } from "./VenueCalendar";

export const dynamic = "force-dynamic";

// Seanslı takvim: düğün salonu gündüz / gece seansları, salonlar ve ortak görünüm.
export default async function VenueCalendarPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/takvim`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !tenant.sector || !isSectorKey(tenant.sector)) notFound();
  const modules = await getModules(db, tenantId);
  if (!moduleAppliesTo("venue_calendar", tenant.sector) || !modules.venue_calendar) notFound();
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const ym = date.slice(0, 7);
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const [halls, items] = await Promise.all([listVenueHalls(db, tenantId), listVenueSessions(db, tenantId, `${ym}-01`, `${ym}-${String(lastDay).padStart(2, "0")}`)]);

  return (
    <PanelShell
      tenantId={tenantId}
      tenantName={tenant.name}
      sectorLabel={SECTORS[tenant.sector].label}
      current="takvim"
      modules={modules}
      role={role}
      publicHref={`/randevu/${tenant.sector}/${tenantId}`}
      title="Seanslı takvim"
    >
      <VenueCalendar tenantId={tenantId} initialHalls={halls} initialItems={items} initialDate={date} />
    </PanelShell>
  );
}
