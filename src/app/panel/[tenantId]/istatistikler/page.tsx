import { getModules } from "@/lib/modules";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { getStats } from "@/lib/stats";
import { isSectorKey, SECTORS } from "@/lib/sectors";
import { PanelShell } from "@/components/panel-shell";

export const dynamic = "force-dynamic";

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", display: "grid", gap: 4 }}>
      <span style={{ color: "var(--muted)", fontSize: ".85rem" }}>{label}</span>
      <strong style={{ fontSize: "1.6rem" }}>{value}</strong>
      {hint && <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>{hint}</span>}
    </div>
  );
}

function Bars({ items, empty }: { items: Array<{ name: string; count: number }>; empty: string }) {
  if (items.length === 0) return <p style={{ color: "var(--muted)", margin: 0 }}>{empty}</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {items.map((i) => (
        <li key={i.name} style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: ".9rem" }}>{i.name} <span style={{ color: "var(--muted)" }}>· {i.count}</span></span>
          <div style={{ height: 8, borderRadius: 999, background: "var(--subtle)" }}>
            <div style={{ height: 8, borderRadius: 999, background: "var(--plum-600, var(--accent))", width: `${(i.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Son 30 günün randevu istatistikleri. Yalnızca üyeler görür.
export default async function StatsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/istatistikler`)}`);
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) notFound();
  // İstatistikler işletmenin tamamını gösterir; yalnızca sahip görür.
  if (role !== "owner") notFound();
  const tenant = await getTenant(db, tenantId);
  const modules = await getModules(db, tenantId);
  if (!modules.stats) notFound();
  if (!tenant || !tenant.sector || !isSectorKey(tenant.sector)) notFound();
  const s = await getStats(db, tenantId, 30);

  return (
    <PanelShell
      tenantId={tenantId}
      tenantName={tenant.name}
      sectorLabel={SECTORS[tenant.sector].label}
      current="istatistikler"
      modules={modules}
      role={role}
      publicHref={`/randevu/${tenant.sector}/${tenantId}`}
      title="İstatistikler"
    >
      <p style={{ margin: 0, color: "var(--muted)" }}>Son {s.days} gün</p>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Card label="Toplam randevu" value={String(s.total)} hint={`${s.upcoming} gelecek randevu`} />
        <Card label="Tamamlandı" value={String(s.completed)} />
        <Card label="Gelmedi" value={String(s.noShow)} hint={`Gelmeme oranı ${pct(s.noShowRate)}`} />
        <Card label="İptal" value={String(s.cancelled)} />
        <Card label="Doluluk" value={pct(s.occupancy)} hint="Çalışma saatlerine göre" />
      </div>
      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div style={{ display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>En çok tercih edilen hizmetler</h2>
          <Bars items={s.topServices} empty="Bu dönemde randevu yok." />
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Personel randevuları</h2>
          <Bars items={s.byStaff} empty="Personel tanımlı değil." />
        </div>
      </section>
    </PanelShell>
  );
}
