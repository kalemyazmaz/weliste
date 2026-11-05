import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./design.css";
import { getDb } from "@/lib/db";
import { getSiteSettings } from "@/lib/site";
import { defaultModeScript, themeCss } from "@/components/theme-style";

export const metadata: Metadata = {
  title: "Weliste — Firma Ara Bul",
  description: "Firma Ara Bul: işletmeleri keşfet, randevunu al, işini yönet.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Weliste", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "var(--plum-700)",
};

export const dynamic = "force-dynamic";

// Kayıtlı tema, sayfa boyanmadan önce uygulanır (yanıp sönmeyi önler).
const themeInit = `try{var t=localStorage.getItem("fiarbu-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Site ayarları (renk, yazı tipi, buton, varsayılan mod) her sayfaya uygulanır.
  const site = await getSiteSettings(getDb());
  return (
    <html lang="tr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit + defaultModeScript(site.theme.defaultMode) }} />
        <style dangerouslySetInnerHTML={{ __html: themeCss(site.theme) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
