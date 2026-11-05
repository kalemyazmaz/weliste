import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { getModules } from "@/lib/modules";
import { moduleAppliesTo } from "@/lib/module-catalog";
import { listDeliverySessions } from "@/lib/delivery";
import { isSectorKey, SECTORS } from "@/lib/sectors";
import { PanelShell } from "@/components/panel-shell";
import { DeliveryManager } from "./DeliveryManager";

export const dynamic = "force-dynamic";

// Fotoğraf teslimi: yalnızca fotoğrafçı sektöründe ve modül açıkken görünür.
export default async function DeliveryPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/teslim`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !tenant.sector || !isSectorKey(tenant.sector)) notFound();
  const modules = await getModules(db, tenantId);
  if (!moduleAppliesTo("photo_delivery", tenant.sector) || !modules.photo_delivery) notFound();
  const sessions = await listDeliverySessions(db, tenantId);

  return (
    <PanelShell
      tenantId={tenantId}
      tenantName={tenant.name}
      sectorLabel={SECTORS[tenant.sector].label}
      current="teslim"
      modules={modules}
      role={role}
      publicHref={`/randevu/${tenant.sector}/${tenantId}`}
      title="Fotoğraf teslimi"
    >
      <DeliveryManager tenantId={tenantId} initialSessions={sessions} />
    </PanelShell>
  );
}
