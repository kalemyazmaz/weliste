import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { getModules } from "@/lib/modules";
import { moduleAppliesTo } from "@/lib/module-catalog";
import { getOrgEvent } from "@/lib/org";
import { AppError } from "@/lib/errors";
import { SECTORS, isSectorKey } from "@/lib/sectors";
import { PanelShell } from "@/components/panel-shell";
import { EventDetail } from "./EventDetail";

export const dynamic = "force-dynamic";

// Etkinlik detayı: bilgiler, ekip, görevler ve (sahip için) bütçe.
export default async function EventDetailPage({ params }: { params: Promise<{ tenantId: string; id: string }> }) {
  const { tenantId, id } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/etkinlikler/${id}`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !tenant.sector || !isSectorKey(tenant.sector)) notFound();
  const modules = await getModules(db, tenantId);
  if (!moduleAppliesTo("org_events", tenant.sector) || !modules.org_events) notFound();
  let detail;
  try {
    detail = await getOrgEvent(db, tenantId, id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
  const isOwner = role === "owner";
  const budgetOn = isOwner && modules.org_budget;

  return (
    <PanelShell tenantId={tenantId} tenantName={tenant.name} sectorLabel={SECTORS[tenant.sector].label} current="etkinlikler" modules={modules} role={role} publicHref={`/randevu/${tenant.sector}/${tenantId}`} title={detail.event.title}>
      <EventDetail tenantId={tenantId} detail={detail} tasksOn={modules.org_tasks} budgetOn={budgetOn} isOwner={isOwner} />
    </PanelShell>
  );
}
