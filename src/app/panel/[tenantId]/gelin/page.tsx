import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { getModules } from "@/lib/modules";
import { moduleAppliesTo } from "@/lib/module-catalog";
import { listBridalFiles } from "@/lib/bridal";
import { SECTORS, isSectorKey } from "@/lib/sectors";
import { PanelShell } from "@/components/panel-shell";
import { BridalManager } from "./BridalManager";

export const dynamic = "force-dynamic";

// Gelin dosyaları: düğün tarihi, deneme, paket ve durum takibi.
export default async function BridalPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/gelin`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !tenant.sector || !isSectorKey(tenant.sector)) notFound();
  const modules = await getModules(db, tenantId);
  if (!moduleAppliesTo("bridal_files", tenant.sector) || !modules.bridal_files) notFound();
  const items = await listBridalFiles(db, tenantId);

  return (
    <PanelShell tenantId={tenantId} tenantName={tenant.name} sectorLabel={SECTORS[tenant.sector].label} current="gelin" modules={modules} role={role} publicHref={`/randevu/${tenant.sector}/${tenantId}`} title="Gelin dosyaları">
      <BridalManager tenantId={tenantId} initialItems={items} />
    </PanelShell>
  );
}
