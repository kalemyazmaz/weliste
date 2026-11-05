import Link from "next/link";
import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/lib/site";

// Alt bilgi: yönetici ayarındaki açıklama, bağlantılar ve kaynak notu.
export async function SiteFooter() {
  const { footer } = await getSiteSettings(getDb());
  return (
    <footer style={{ padding: "24px 0 48px", background: "var(--bg)", color: "var(--text)" }}>
      <div className="container" style={{ display: "grid", gap: 14, fontSize: ".9rem", color: "var(--text)" }}>
        {footer.credit && <p style={{ margin: 0, maxWidth: "70ch", color: "var(--muted)" }}>{footer.credit}</p>}
        <p style={{ margin: 0, maxWidth: "70ch", color: "var(--muted)" }}>{footer.text}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {footer.links.map((l) => (
            <Link key={l.href + l.label} href={l.href} style={{ color: "var(--text)" }}>{l.label}</Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
