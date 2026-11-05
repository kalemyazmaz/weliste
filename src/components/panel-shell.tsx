import Link from "next/link";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { moduleAppliesTo } from "@/lib/module-catalog";
import { AccountMenu, type AccountLink } from "@/components/account-menu";
import { NotificationBell } from "@/components/notification-bell";
import { BrandMark } from "@/components/brand-mark";
import { LogoutButton } from "@/components/logout-button";
import { PanelIcon } from "@/components/panel-icons";
import { PanelNav, type NavGroup, type NavItem } from "@/components/panel-nav";

type Key = "randevular" | "musteriler" | "hizmetler" | "personel" | "istatistikler" | "kasa" | "ayarlar" | "isletme-profili" | "teslim" | "takvim" | "teklifler" | "tedarikci" | "paylasim" | "etkinlikler" | "gelin";

// İşletme paneli çerçevesi: masaüstünde sol menü, mobilde üst çubuk ve alt gezinme.
export async function PanelShell({ tenantId, tenantName, sectorLabel, current, publicHref, role, modules, title, children }: {
  tenantId: string;
  tenantName: string;
  sectorLabel: string | null;
  current: Key;
  publicHref: string | null;
  role?: string;
  modules?: Record<string, boolean>;
  title: string;
  children: React.ReactNode;
}) {
  const isOwner = role === "owner";
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = token ? await currentUser(getDb(), token) : null;
  const accountLinks: AccountLink[] = [
    ...(isOwner ? [{ label: "İşletme profili", href: `/panel/${tenantId}/isletme-profili` }] : []),
    { label: "İşletme ayarları", href: `/panel/${tenantId}/ayarlar` },
    { label: "Şifre değiştir", href: `/panel/${tenantId}/ayarlar#sifre` },
  ];
  const enabled = (key: Key) => {
    if (key === "istatistikler") return modules?.stats !== false;
    if (key === "kasa") return modules?.ledger !== false;
    return true;
  };
  const item = (key: Key, label: string, icon: string, ownerOnly = false): NavItem | null =>
    (ownerOnly && !isOwner) || !enabled(key) ? null : { key, label, icon, href: `/panel/${tenantId}/${key}` };
  const groups: NavGroup[] = [
    { title: "Yönetim", items: [item("isletme-profili", "İşletme profili", "store", true), item("ayarlar", "İşletme ayarları", "gear")].filter(Boolean) as NavItem[] },
    {
      title: "Randevu sistemi",
      items: [
        item("randevular", "Randevular", "calendar"),
        item("musteriler", "Müşterilerim", "users"),
        item("hizmetler", "Hizmetler", "scissors"),
        item("personel", "Personel", "user"),
        item("istatistikler", "İstatistikler", "chart", true),
        item("kasa", "Gelir / Gider", "wallet", true),
      ].filter(Boolean) as NavItem[],
    },
  ];
  // İşletme türüne özel modüller: yalnızca sektörde görünen ve açık olanlar.
  const tenant = await getTenant(getDb(), tenantId);
  const sectorItems: NavItem[] = [];
  const tools: Array<{ mod: "photo_delivery" | "venue_calendar" | "venue_inquiries" | "venue_suppliers" | "venue_share" | "org_events" | "bridal_files"; key: Key; label: string; icon: string; path: string }> = [
    { mod: "bridal_files", key: "gelin", label: "Gelin dosyaları", icon: "users", path: "gelin" },
    { mod: "org_events", key: "etkinlikler", label: "Etkinlikler", icon: "calendar", path: "etkinlikler" },
    { mod: "photo_delivery", key: "teslim", label: "Fotoğraf teslimi", icon: "camera", path: "teslim" },
    { mod: "venue_calendar", key: "takvim", label: "Seanslı takvim", icon: "calendar", path: "takvim" },
    { mod: "venue_inquiries", key: "teklifler", label: "Teklif talepleri", icon: "users", path: "teklifler" },
    { mod: "venue_suppliers", key: "tedarikci", label: "Tedarikçiler", icon: "store", path: "tedarikci" },
    { mod: "venue_share", key: "paylasim", label: "Paylaşım linkleri", icon: "link", path: "paylasim" },
  ];
  for (const t of tools) {
    if (moduleAppliesTo(t.mod, tenant?.sector) && modules?.[t.mod] !== false) {
      sectorItems.push({ key: t.key, label: t.label, icon: t.icon, href: `/panel/${tenantId}/${t.path}` });
    }
  }
  if (sectorItems.length) groups.push({ title: "Sektör araçları", items: sectorItems });
  if (publicHref) groups.push({ title: "Diğer", items: [{ key: "public", label: "Müşteri sayfası", href: publicHref, icon: "link", external: true }] });
  const quick = (["randevular", "musteriler", "personel", "kasa"] as Key[])
    .map((k) => groups[1].items.find((i) => i.key === k))
    .filter(Boolean) as NavItem[];

  return (
    <div className="pn-app">
      <aside className="pn-side" aria-label="Panel menüsü">
        <Link className="brand" href="/randevu" style={{ padding: "4px 8px 12px" }}><BrandMark />Weliste</Link>
        <div className="pn-tenant">
          <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tenantName}</strong>
          <span style={{ color: "var(--muted)", fontSize: ".82rem" }}>{sectorLabel ?? "Randevu"}</span>
        </div>
        <nav style={{ display: "grid", gap: 14 }}>
          {groups.map((g) => (
            <section key={g.title}>
              <p className="pn-group-title">{g.title}</p>
              {g.items.map((i) =>
                i.external ? (
                  <Link key={i.key} href={i.href} className="pn-link" target="_blank" rel="noopener noreferrer"><PanelIcon name={i.icon} /><span>{i.label}</span></Link>
                ) : (
                  <Link key={i.key} href={i.href} className="pn-link" aria-current={current === i.key ? "page" : undefined}><PanelIcon name={i.icon} /><span>{i.label}</span></Link>
                ),
              )}
            </section>
          ))}
        </nav>
        <div style={{ marginTop: "auto" }}><LogoutButton /></div>
      </aside>

      <div className="pn-content">
        <header className="pn-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Link className="brand pn-m-only" href="/randevu"><BrandMark size={24} />Weliste</Link>
            <span style={{ color: "var(--muted)", fontSize: ".82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{tenantName}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <NotificationBell tenantId={tenantId} />
            {user && <AccountMenu email={user.email} links={accountLinks} />}
          </div>
        </header>
        <main id="icerik" className="pn-main">
          <h1 style={{ margin: 0 }}>{title}</h1>
          {children}
        </main>
      </div>

      <PanelNav groups={groups} current={current} quick={quick} />
    </div>
  );
}
