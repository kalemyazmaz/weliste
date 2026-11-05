import { cookies } from "next/headers";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { AccountMenu, type AccountLink } from "@/components/account-menu";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { userTenants } from "@/lib/service";
import { SECTOR_KEYS, SECTORS } from "@/lib/sectors";
import { getSiteSettings } from "@/lib/site";

// Üst menü: sektör bağlantıları, yönetici ayarındaki ek bağlantılar ve vurgu düğmesi; sağda hesap alanı.
export async function RandevuHeader() {
  const db = getDb();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = token ? await currentUser(db, token) : null;
  const tenants = user ? await userTenants(db, user.id) : [];
  const site = await getSiteSettings(db);
  const h = site.header;
  const links: AccountLink[] = tenants.map((t) => ({ label: tenants.length > 1 ? `Panel: ${t.name}` : "Panelime git", href: `/panel/${t.id}/randevular` }));
  if (user?.isAdmin) links.push({ label: "Yönetim paneli", href: "/admin" });

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="brand" href="/randevu" style={{ flexShrink: 0 }}><BrandMark />Weliste</Link>
        <nav aria-label="Sektörler" className="site-header__actions site-header__sectors" style={{ flexWrap: "wrap", maxWidth: "100%", minWidth: 0 }}>
          {h.showSectorLinks && SECTOR_KEYS.map((k) => (
            <Link key={k} href={`/randevu/${k}`} className="btn btn--ghost btn--sm">{SECTORS[k].label}</Link>
          ))}
          {h.links.map((l) => (
            <Link key={l.href + l.label} href={l.href} className="btn btn--ghost btn--sm">{l.label}</Link>
          ))}
        </nav>
        {user ? (
          <AccountMenu email={user.email} links={links} />
        ) : (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Link href="/kayit" className="btn btn--primary btn--sm">Kayıt ol</Link>
            <Link href="/giris" className="btn btn--ghost btn--sm">Giriş yap</Link>
            {h.ctaLabel && h.ctaHref && <Link href={h.ctaHref} className="btn btn--primary btn--sm">{h.ctaLabel}</Link>}
          </div>
        )}
      </div>
    </header>
  );
}
