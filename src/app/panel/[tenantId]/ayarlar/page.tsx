import { getModules } from "@/lib/modules";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant, listAudit } from "@/lib/service";
import { getProfile, minToClock } from "@/lib/workspace";
import { listMembers } from "@/lib/members";
import { SettingsManager } from "./SettingsManager";
import { PanelShell } from "@/components/panel-shell";
import { SECTORS, type SectorKey } from "@/lib/sectors";

export const dynamic = "force-dynamic";

// İşletme ayarları: profil ve yayın, çalışma saatleri, ekip, hesap ve müşteri sayfası önizlemesi.
export default async function SettingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/ayarlar`)}`);

  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  const tenant = await getTenant(db, tenantId);
  const modules = await getModules(db, tenantId);
  if (!tenant || !tenant.sector) notFound();

  const [profile, members] = await Promise.all([getProfile(db, tenantId), listMembers(db, tenantId)]);
  const audit = role === "owner" ? (await listAudit(db, tenantId, 50)).map((a) => ({ id: String(a.id), action: String(a.action), target: a.target ? String(a.target) : null, actorId: a.actor_user_id ? String(a.actor_user_id) : null, createdAt: String(a.created_at) })) : [];
  const days = profile.dayHours.map((d) => ({
    on: d !== null,
    opensAt: minToClock(d?.open ?? profile.opensMin),
    closesAt: minToClock(d?.close ?? profile.closesMin),
  }));

  return (
    <PanelShell
      tenantId={tenantId}
      tenantName={tenant.name}
      sectorLabel={SECTORS[tenant.sector as SectorKey]?.label ?? null}
      current="ayarlar"
      modules={modules}
      role={role}
      publicHref={`/randevu/${tenant.sector}/${tenantId}`}
      title="Ayarlar"
    >
      <SettingsManager
        tenantId={tenantId}
        sector={tenant.sector}
        members={members}
        audit={audit}
        currentUserId={user.id}
        publicSrc={`/randevu/${tenant.sector}/${tenantId}`}
        isOwner={role === "owner"}
        modules={modules}
        profile={profile}
        days={days}
      />
    </PanelShell>
  );
}
