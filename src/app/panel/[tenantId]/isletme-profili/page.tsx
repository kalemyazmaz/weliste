import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { getModules } from "@/lib/modules";
import { getProfile } from "@/lib/workspace";
import { PublicPreview } from "../ayarlar/PublicPreview";
import { getBusinessProfile } from "@/lib/business-profile";
import { listServices } from "@/lib/workspace";
import { isSectorKey, SECTORS } from "@/lib/sectors";
import { PanelShell } from "@/components/panel-shell";
import { BusinessProfileEditor } from "./BusinessProfileEditor";

export const dynamic = "force-dynamic";

// İşletme profili (görünen kısım): yalnızca sahip düzenler.
export default async function BusinessProfilePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/isletme-profili`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role || role !== "owner") notFound();
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !tenant.sector || !isSectorKey(tenant.sector)) notFound();
  const profile = await getBusinessProfile(db, tenantId);
  if (!profile) notFound();
  const services = await listServices(db, tenantId);
  const [modules, wp] = await Promise.all([getModules(db, tenantId), getProfile(db, tenantId)]);

  return (
    <PanelShell
      tenantId={tenantId}
      tenantName={tenant.name}
      sectorLabel={SECTORS[tenant.sector].label}
      current="isletme-profili"
      role={role}
      publicHref={`/randevu/${tenant.sector}/${tenantId}`}
      title="İşletme profili"
    >
      {!wp.published && (
        <p role="status" style={{ margin: "0 0 16px", padding: 14, borderRadius: 14, background: "var(--gold-100)", color: "var(--text)" }}>
          Profil yayında değil. Müşteriler işletmenizi sektör listesinde ve müşteri sayfasında göremez. Yayınlamak için <a href={`/panel/${tenantId}/ayarlar`} style={{ color: "var(--accent)", fontWeight: 700 }}>işletme ayarlarındaki</a> “Profili yayınla” seçeneğini işaretleyin.
        </p>
      )}
      <BusinessProfileEditor tenantId={tenantId} profile={profile} serviceCount={services.length} />
      {modules.preview !== false && (
        <section style={{ display: "grid", gap: 12, marginTop: 20 }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Müşteri sayfası önizlemesi</h2>
          <p className="muted" style={{ margin: 0 }}>Müşterilerin randevu alırken gördüğü sayfa. Profil ve hizmet değişikliklerinden sonra sayfayı yenileyin.</p>
          <PublicPreview src={`/randevu/${tenant.sector}/${tenantId}`} published={wp.published} />
        </section>
      )}
    </PanelShell>
  );
}
