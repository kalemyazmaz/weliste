import Link from "next/link";
import { notFound } from "next/navigation";
import { RandevuHeader } from "@/components/randevu-shell";
import { getDb } from "@/lib/db";
import { listSectorCards } from "@/lib/booking-public";
import { isSectorKey, SECTORS } from "@/lib/sectors";
import { FirmCard } from "@/components/firm-card";
import { SECTOR_PHOTO } from "@/lib/sector-photos";
import { LIGHT_PAGE } from "@/components/light-page";

export const dynamic = "force-dynamic";

const INK = "var(--text)";
const NAVY = "var(--plum-700)";
const STONE = "var(--bg)";
const MUTED = "var(--muted)";
const TEAL = "var(--accent)";
const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

// Sektör listesi: her firma bir kart; kapak, logo, konum, hizmetler ve iki işlem (Hizmetler, Firmayı İncele).
export default async function SectorPage({ params }: { params: Promise<{ sektor: string }> }) {
  const { sektor } = await params;
  if (!isSectorKey(sektor)) notFound();
  const sector = SECTORS[sektor];
  const cards = await listSectorCards(getDb(), sektor);
  const photo = SECTOR_PHOTO[sektor];
  return (
    <>
      <RandevuHeader />
      <main id="icerik" style={{ ...LIGHT_PAGE, minHeight: "70svh" }}>
        <section style={{ position: "relative", minHeight: "min(62svh, 560px)", display: "flex", alignItems: "flex-end", color: "#fff", overflow: "hidden", background: NAVY }}>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.src} alt={photo.alt} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          )}
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "rgba(8, 22, 36, 0.62)" }} />
          <div className="container" style={{ position: "relative", display: "grid", gap: 16, paddingTop: 120, paddingBottom: 48 }}>
            <h1 className="fb-in" style={{ fontFamily: "var(--font-display)", margin: 0, fontSize: "clamp(2.2rem, 5.2vw, 4rem)", lineHeight: 1.02, letterSpacing: "-0.03em", fontWeight: 800 }}>{sector.listingNoun}</h1>
            <p className="fb-in fb-in-2" style={{ margin: 0, fontSize: "clamp(1.05rem, 1.6vw, 1.25rem)", lineHeight: 1.5, maxWidth: "52ch", color: "rgba(255,255,255,0.9)" }}>{sector.intro}</p>
            <Link href="/randevu" style={{ color: "#fff", fontWeight: 700, justifySelf: "start", textDecoration: "underline" }}>Tüm sektörler</Link>
          </div>
        </section>

        <section className="container" style={{ paddingTop: 48, paddingBottom: 96 }}>
          {cards.length === 0 ? (
            <p style={{ margin: 0, color: MUTED, fontSize: "1.05rem" }}>Bu sektörde henüz yayında firma yok.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 320px))", justifyContent: "start" }}>
              {cards.map((c) => <FirmCard key={c.tenantId} c={c} compact />)}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
