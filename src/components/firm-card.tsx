import Link from "next/link";
import type { SectorCard } from "@/lib/booking-public";
import { SECTORS } from "@/lib/sectors";

const INK = "var(--text)";
const NAVY = "var(--plum-700)";
const STONE = "var(--bg)";
const MUTED = "var(--muted)";
const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

// Firma kartı: kapak, logo, konum, hizmet etiketleri, en düşük fiyat ve iki işlem (Hizmetler, Firmayı İncele).
export function FirmCard({ c, compact = false }: { c: SectorCard; compact?: boolean }) {
  const k = compact ? 0.72 : 1; // kompakt kartta tüm ölçüler oranla küçülür
  const base = `/randevu/${c.sector}/${c.tenantId}`;
  const tags = c.services.slice(0, compact ? 1 : 3);
  return (
    <li className="fb-view">
      <article className="fb-lift" style={{ display: "grid", borderRadius: 22, overflow: "hidden", background: "var(--surface)", height: "100%" }}>
        <div className="fb-view" style={{ position: "relative", aspectRatio: compact ? "16 / 6" : "16 / 9", background: NAVY }}>
          {c.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          )}
          <div style={{ position: "absolute", left: compact ? 12 : 18, bottom: compact ? -18 : -28, width: 64 * k, height: 64 * k, borderRadius: 16 * k, background: "var(--surface)", border: "3px solid #fff", overflow: "hidden", display: "grid", placeItems: "center" }}>
            {c.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logo} alt={`${c.name} logosu`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span aria-hidden="true" style={{ fontWeight: 800, color: NAVY, fontSize: 22 }}>{c.name[0]}</span>
            )}
          </div>
        </div>
        <div className="fb-view" style={{ display: "grid", gap: compact ? 6 : 12, padding: compact ? "26px 12px 12px" : "42px 20px 20px" }}>
          <Link href={base} style={{ color: INK, textDecoration: "none" }}>
            <strong style={{ display: "block", fontSize: compact ? "1rem" : "1.2rem", letterSpacing: "-0.01em", lineHeight: 1.25 }}>{c.name}</strong>
          </Link>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: compact ? ".82rem" : ".95rem" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
            {c.city || "Konum belirtilmedi"}
          </span>
          {tags.length > 0 && (
            <ul aria-label="Hizmetler" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tags.map((t) => <li key={t} style={{ padding: "5px 11px", borderRadius: 999, background: STONE, fontSize: ".85rem", fontWeight: 600 }}>{t}</li>)}
              {c.serviceCount > tags.length && <li style={{ padding: "5px 11px", fontSize: ".85rem", color: MUTED }}>+{c.serviceCount - tags.length}</li>}
            </ul>
          )}
          {compact ? (
            <>
              <span style={{ fontWeight: 700, color: MUTED, fontSize: ".85rem" }}>{c.minPriceTl ? `${tl(c.minPriceTl)}'den` : "Fiyat için sor"}</span>
              <div style={{ display: "grid", gap: 6, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.5fr)" }}>
                <Link href={`${base}#hizmetler`} style={{ padding: "8px 6px", borderRadius: 10, background: STONE, color: INK, fontWeight: 700, textAlign: "center", textDecoration: "none", fontSize: ".8rem", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Hizmetler</Link>
                <Link href={base} style={{ padding: "8px 6px", borderRadius: 10, background: NAVY, color: "#fff", fontWeight: 700, textAlign: "center", textDecoration: "none", fontSize: ".8rem", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Firmayı İncele</Link>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingTop: 4 }}>
                <span style={{ fontWeight: 700, color: MUTED, fontSize: ".95rem" }}>{c.minPriceTl ? `${tl(c.minPriceTl)}'den` : "Fiyat için sor"}</span>
              </div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                <Link href={`${base}#hizmetler`} style={{ padding: "11px 10px", whiteSpace: "nowrap", fontSize: ".95rem", borderRadius: 12, background: STONE, color: INK, fontWeight: 700, textAlign: "center", textDecoration: "none" }}>Hizmetler</Link>
                <Link href={base} style={{ padding: "11px 10px", borderRadius: 12, background: NAVY, color: "#fff", fontWeight: 700, textAlign: "center", textDecoration: "none", whiteSpace: "nowrap", fontSize: ".95rem" }}>Firmayı İncele</Link>
              </div>
            </>
          )}
        </div>
      </article>
    </li>
  );
}
