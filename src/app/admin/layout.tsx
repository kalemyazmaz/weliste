import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { requireAdmin } from "@/lib/admin";
import { AppError } from "@/lib/errors";
import { BrandMark } from "@/components/brand-mark";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin", label: "Özet" },
  { href: "/admin/kullanicilar", label: "Kullanıcılar" },
  { href: "/admin/paketler", label: "Paketler" },
  { href: "/admin/moduller", label: "Modüller" },
  { href: "/admin/icerik", label: "Ön sayfa, header, footer" },
  { href: "/admin/site", label: "Site ayarları" },
];

// Platform yönetim paneli çerçevesi. Yalnız yöneticiler görür; oturum yoksa girişe, yetki yoksa 404'e gider.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  try {
    await requireAdmin(getDb(), token);
  } catch (err) {
    if (err instanceof AppError && err.status === 401) redirect(`/giris?next=${encodeURIComponent("/admin")}`);
    notFound();
  }
  return (
    <div className="pn-app">
      <aside className="pn-side" aria-label="Yönetim menüsü">
        <Link className="brand" href="/admin" style={{ padding: "4px 8px 12px" }}><BrandMark />Weliste · Yönetim</Link>
        <nav style={{ display: "grid", gap: 4 }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="pn-link"><span>{l.label}</span></Link>
          ))}
        </nav>
        <div style={{ marginTop: "auto" }}><LogoutButton /></div>
      </aside>
      <div className="pn-content">
        <header className="pn-topbar"><span style={{ color: "var(--muted)", fontSize: ".9rem" }}>Platform yönetimi</span><Link href="/randevu" style={{ color: "var(--accent)", fontWeight: 700 }}>Siteye git →</Link></header>
        <main className="pn-main">{children}</main>
      </div>
    </div>
  );
}
