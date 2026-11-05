import Link from "next/link";
import { RandevuHeader } from "@/components/randevu-shell";
import { getDb } from "@/lib/db";
import { listHomeListings, toSectorCards } from "@/lib/booking-public";
import { FirmCard } from "@/components/firm-card";
import { LIGHT_PAGE } from "@/components/light-page";
import { SECTOR_PHOTO } from "@/lib/sector-photos";
import { SECTOR_KEYS, SECTORS, type SectorKey } from "@/lib/sectors";
import { SearchBar } from "./SearchBar";
import { SiteFooter } from "@/components/site-footer";
import { getSiteSettings } from "@/lib/site";

export const dynamic = "force-dynamic";

const NAVY = "var(--plum-700)";
const INK = "var(--text)";
const STONE = "var(--bg)";
const TURQUOISE = "var(--accent)";
const MUTED = "var(--muted)";
const heading = { margin: 0, fontSize: "clamp(1.7rem, 3.4vw, 2.5rem)", lineHeight: 1.08, letterSpacing: "-0.02em", color: INK, fontWeight: 800 } as const;


const PLANNING = [
  { title: "Tarihi önce kesinleştirin", text: "Salon ve fotoğrafçılar tarihe göre dolar. Tarihinizi belirleyin, sonra tarihe uygun firmaları karşılaştırın." },
  { title: "Bütçeyi kalemlere bölün", text: "Salon, yemek, fotoğraf, saç-makyaj ve organizasyon ayrı kalemlerdir. Kalemler için teklif isteyin." },
  { title: "Teklifleri aynı kriterle okuyun", text: "Kişi sayısı, menü, dahil olanlar ve kapora koşulları her firmada farklıdır. Yazılı teklif isteyin." },
];

const MOTION_CSS = `
@keyframes fb-rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
.fb-in { animation: fb-rise .9s cubic-bezier(.2,.7,.2,1) both; }
.fb-in-2 { animation-delay: .12s; }
.fb-in-3 { animation-delay: .24s; }
.fb-view { animation: fb-rise linear both; animation-timeline: view(); animation-range: entry 0% entry 35%; }
.fb-lift { transition: transform .2s ease; }
.fb-lift:hover, .fb-lift:focus-visible { transform: translateY(-3px); }
.fb-press:active { transform: scale(.98); }
@media (prefers-reduced-motion: reduce) { .fb-in, .fb-view { animation: none; } .fb-lift, .fb-press { transition: none; transform: none; } }
`;

export default async function RandevuIndex() {
  const db = getDb();
  const site = await getSiteSettings(db);
  const H = site.home;
  const { newest: newestRaw, featured: featuredRaw } = await listHomeListings(db);
  const [newest, featured] = await Promise.all([toSectorCards(db, newestRaw), toSectorCards(db, featuredRaw)]);
  return (
    <>
      <RandevuHeader />
      <main id="icerik" style={{ ...LIGHT_PAGE, fontSize: 17 }}>
        <section style={{ position: "relative", minHeight: "min(92svh, 820px)", display: "flex", alignItems: "flex-end", color: "#fff", overflow: "hidden", background: NAVY }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/randevu/hero-hall-jpg.jpg" alt="Ahşap oymalı, törensel bir salonun iç görünümü" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 45%" }} />
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "rgba(8, 22, 36, 0.68)" }} />
          <div className="container" style={{ position: "relative", display: "grid", gap: 28, paddingTop: 120, paddingBottom: 56 }}>
            <h1 className="fb-in" style={{ fontFamily: "var(--font-display)", margin: 0, fontSize: "clamp(2.4rem, 6.4vw, 5.2rem)", lineHeight: 0.98, letterSpacing: "-0.035em", fontWeight: 800, maxWidth: "18ch" }}>
              {H.heroTitle}
            </h1>
            <p className="fb-in fb-in-2" style={{ margin: 0, fontSize: "clamp(1.05rem, 1.6vw, 1.25rem)", lineHeight: 1.5, maxWidth: "48ch", color: "rgba(255,255,255,0.9)" }}>
              {H.heroText}
            </p>
            <div className="fb-in fb-in-3"><SearchBar /></div>
          </div>
        </section>

        <section className="container" style={{ paddingTop: 96, paddingBottom: 72, display: "grid", gap: 32 }}>
          <h2 className="fb-view" style={heading}>{H.sectorsTitle}</h2>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {SECTOR_KEYS.map((k) => {
              const photo = SECTOR_PHOTO[k];
              return (
                <Link key={k} href={`/randevu/${k}`} className="fb-view fb-lift fb-press" style={{ display: "grid", borderRadius: 20, overflow: "hidden", background: "var(--surface)", color: INK, textDecoration: "none" }}>
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.src} alt={photo.alt} style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }} />
                  ) : (
                    <span aria-hidden="true" style={{ display: "grid", alignContent: "end", width: "100%", aspectRatio: "4 / 3", background: NAVY, color: "#fff", padding: 22, boxSizing: "border-box", fontSize: "clamp(2rem, 3vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{SECTORS[k].label}</span>
                  )}
                  <span style={{ display: "grid", gap: 10, padding: 22 }}>
                    <strong style={{ fontSize: "1.35rem", letterSpacing: "-0.02em" }}>{SECTORS[k].label}</strong>
                    <span style={{ fontSize: ".98rem", lineHeight: 1.5, color: MUTED, maxWidth: "60ch" }}>{SECTORS[k].intro}</span>
                    <span style={{ fontWeight: 700, color: "var(--accent)" }}>{SECTORS[k].listingNoun} →</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section style={{ background: "var(--surface)" }}>
          <div className="container" style={{ paddingTop: 96, paddingBottom: 96, display: "grid", gap: 36 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap" }}>
              <h2 className="fb-view" style={heading}>{H.newTitle}</h2>
              <Link href="/randevu/dugun-salonu" style={{ fontWeight: 700, color: "var(--accent)" }}>Düğün salonlarına git →</Link>
            </div>
            {newest.length === 0 ? (
              <p style={{ margin: 0, color: MUTED }}>Henüz yayında firma yok. İlk firmalardan biri olun.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))" }}>
                {newest.map((c) => (
                  <FirmCard key={c.tenantId} c={c} compact />
                ))}
              </ul>
            )}
          </div>
        </section>

        {H.showFeatured && featured.length > 0 && (
          <section className="container" style={{ paddingTop: 96, paddingBottom: 72, display: "grid", gap: 36 }}>
            <h2 className="fb-view" style={heading}>{H.featuredTitle}</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))" }}>
              {featured.map((c) => (
                <FirmCard key={c.tenantId} c={c} compact />
              ))}
            </ul>
          </section>
        )}

        <section className="container" style={{ paddingBottom: 96, display: "grid", gap: 36 }}>
          <h2 className="fb-view" style={heading}>{H.planningTitle}</h2>
          <div style={{ display: "grid", gap: 32, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {PLANNING.map((p) => (
              <article key={p.title} className="fb-view" style={{ display: "grid", gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: "1.2rem", color: INK }}>{p.title}</h3>
                <p style={{ margin: 0, lineHeight: 1.6, color: MUTED, maxWidth: "60ch" }}>{p.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="container" style={{ paddingBottom: 96 }}>
          <div className="fb-view" style={{ display: "grid", gap: 20, padding: "clamp(28px, 5vw, 56px)", borderRadius: 24, background: NAVY, color: "#fff", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center" }}>
            <div style={{ display: "grid", gap: 10 }}>
              <h2 style={{ ...heading, color: "#fff" }}>{H.ctaTitle}</h2>
              <p style={{ margin: 0, lineHeight: 1.55, color: "rgba(255,255,255,0.88)", maxWidth: "52ch" }}>{H.ctaText}</p>
            </div>
            <Link href="/kayit" className="fb-press" style={{ padding: "14px 22px", borderRadius: 12, background: TURQUOISE, color: INK, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>{H.ctaButton}</Link>
          </div>
        </section>

        <SiteFooter />
      </main>
      <style>{MOTION_CSS}</style>
    </>
  );
}
