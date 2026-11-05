import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/lib/site";
import { ThemeEditor } from "./ThemeEditor";

export const dynamic = "force-dynamic";

export default async function SitePage() {
  const s = await getSiteSettings(getDb());
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Site ayarları</h1>
      <p style={{ margin: 0, color: "var(--muted)" }}>Renk paleti, yazı tipleri, buton biçimi ve açık/koyu mod. Değişiklikler tüm siteye ve panele uygulanır.</p>
      <ThemeEditor theme={s.theme} />
    </div>
  );
}
