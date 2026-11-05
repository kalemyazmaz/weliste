import { notFound } from "next/navigation";
import { RandevuHeader } from "@/components/randevu-shell";
import { getDb } from "@/lib/db";
import { getBookingPage } from "@/lib/booking-public";
import { getPublicBusinessPage } from "@/lib/business-profile";
import { isSectorKey, SECTORS } from "@/lib/sectors";
import { BookingForm } from "./BookingForm";
import { ReviewForm } from "./ReviewForm";
import { LIGHT_PAGE } from "@/components/light-page";
import { InquiryForm } from "./InquiryForm";
import { fitStyle } from "@/lib/image-fit";
import { venueMenuLabel } from "@/lib/venue-catalog";

export const dynamic = "force-dynamic";

const TL = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
const minToClock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
const sectionTitle = { margin: 0, fontSize: "1.05rem" } as const;
const card = { display: "grid", gap: 8, padding: 14, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)" } as const;

// İşletmenin herkese açık sayfası: profil, hizmetler, galeri, konum, randevu kartı ve en altta yorumlar.
export default async function BusinessPage({ params }: { params: Promise<{ sektor: string; tenantId: string }> }) {
  const { sektor, tenantId } = await params;
  if (!isSectorKey(sektor)) notFound();
  const db = getDb();
  const [page, booking] = await Promise.all([getPublicBusinessPage(db, tenantId), getBookingPage(db, tenantId)]);
  if (!page || !booking || page.sector !== sektor) notFound();
  const inquirySector = sektor === "dugun-salonu" || sektor === "organizasyon";
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${page.address} ${page.city}`.trim())}`;
  const total = page.ratingBreakdown.reduce((a, b) => a + b, 0);
  const labels = ["5", "4", "3", "2", "1"];

  return (
    <>
      <RandevuHeader />
      <main id="icerik" style={LIGHT_PAGE}>
        <section style={{ position: "relative", height: "clamp(160px, 28vw, 300px)", background: "var(--plum-700)" }}>
          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            {page.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.cover} alt="" style={fitStyle(page.coverFit)} />
            )}
          </div>
          <div className="container" style={{ position: "absolute", left: 0, right: 0, bottom: -44, display: "flex", alignItems: "flex-end", gap: 16 }}>
            {page.logo ? (
              <div style={{ width: 96, height: 96, borderRadius: 20, overflow: "hidden", border: "4px solid var(--bg)", background: "var(--surface)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page.logo} alt="" style={fitStyle(page.logoFit)} />
              </div>
            ) : (
              <div aria-hidden="true" style={{ width: 96, height: 96, borderRadius: 20, border: "4px solid var(--bg)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 32, color: "#fff", background: "var(--plum-700)" }}>{page.name[0]}</div>
            )}
          </div>
        </section>

        <div className="container" style={{ paddingTop: 64, display: "grid", gap: 28 }}>
          <div className="bp-grid" style={{ display: "grid", gap: 28, alignItems: "start" }}>
            <div style={{ display: "grid", gap: 26, minWidth: 0 }}>
              <header style={{ display: "grid", gap: 6 }}>
                <h1 style={{ margin: 0, fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>{page.name}</h1>
                <span style={{ color: "var(--muted)" }}>{SECTORS[sektor].label} · {page.city}</span>
                <span style={{ color: "var(--muted)", fontSize: ".92rem" }}>
                  <span style={{ color: "#f59e0b" }}>{stars(page.rating.average)}</span> {page.rating.count > 0 ? `${page.rating.average.toFixed(1)} · ${page.rating.count} değerlendirme` : "Henüz değerlendirme yok"}
                </span>
              </header>

              {page.description && (
                <section style={{ display: "grid", gap: 8 }}>
                  <h2 style={sectionTitle}>İşletme hakkında</h2>
                  <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>{page.description}</p>
                </section>
              )}

              {page.amenities.length > 0 && (
                <section style={{ display: "grid", gap: 10 }}>
                  <h2 style={sectionTitle}>Olanaklar</h2>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {page.amenities.map((a) => (
                      <li key={a} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface)", fontSize: ".9rem", fontWeight: 600 }}>{a}</li>
                    ))}
                  </ul>
                </section>
              )}

              {page.showServices && booking.services.length > 0 && (
                <section id="hizmetler" style={{ display: "grid", gap: 10, scrollMarginTop: 96 }}>
                  <h2 style={sectionTitle}>Hizmetler</h2>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                    {booking.services.map((s) => (
                      <li key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)" }}>
                        <span><strong>{s.name}</strong> <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>{sektor === "dugun-salonu" ? `· ${s.guestCount ?? "–"} kişi · ${venueMenuLabel(s.menu) || "Menü belirtilmedi"}` : `· ${s.durationMin} dk`}</span></span>
                        {page.showPrices && <span style={{ fontWeight: 700 }}>{s.priceTl > 0 ? TL(s.priceTl) : "Belirtilmemiş"}</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {page.gallery.length > 0 && (
                <section style={{ display: "grid", gap: 10 }}>
                  <h2 style={sectionTitle}>Fotoğraflar</h2>
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}>
                    {page.gallery.map((g, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={g} alt={`${page.name} fotoğraf ${i + 1}`} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 10 }} />
                    ))}
                  </div>
                </section>
              )}

              <section style={{ display: "grid", gap: 10 }}>
                <h2 style={sectionTitle}>Konum</h2>
                <div style={{ ...card, gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center" }}>
                  <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                    <strong>{page.city}</strong>
                    <span style={{ color: "var(--muted)", overflowWrap: "anywhere" }}>{page.address || "Adres henüz eklenmedi"}</span>
                  </div>
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{ padding: "10px 14px", borderRadius: 12, background: "var(--plum-700)", color: "#fff", fontWeight: 700, whiteSpace: "nowrap", textDecoration: "none" }}>Yol tarifi al</a>
                </div>
              </section>
            </div>

            <aside className="bp-side" style={{ display: "grid", gap: 14 }}>
              {!inquirySector && <div style={card}>
                <strong>{page.isOpenNow ? "Şu an açık" : page.hoursToday ? "Şu an kapalı" : "Bugün kapalı"}</strong>
                <span style={{ color: "var(--muted)", fontSize: ".92rem" }}>
                  {page.hoursToday ? `Bugün ${minToClock(page.hoursToday.open)} – ${minToClock(page.hoursToday.close)}` : "Bugün randevu alınamıyor"}
                </span>
                {page.phone && <a href={`tel:${page.phone.replace(/\s/g, "")}`} style={{ color: "var(--text)", fontWeight: 700 }}>📞 {page.phone}</a>}
              </div>}
              {inquirySector ? (
                <InquiryForm tenantId={page.tenantId} />
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <h2 style={sectionTitle}>Online randevu</h2>
                  <BookingForm tenantId={page.tenantId} services={booking.services} staff={booking.staff} />
                </div>
              )}
            </aside>
          </div>

          <section style={{ display: "grid", gap: 16, paddingBottom: 48 }}>
            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Müşteri değerlendirmeleri</h2>
            <div className="rv-grid" style={{ display: "grid", gap: 20, alignItems: "start" }}>
              <div style={{ ...card, gap: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: "2.4rem", fontWeight: 800, lineHeight: 1 }}>{page.rating.count > 0 ? page.rating.average.toFixed(1) : "–"}</span>
                  <span style={{ color: "#f59e0b", fontSize: "1.2rem" }}>{stars(page.rating.average)}</span>
                </div>
                <span style={{ color: "var(--muted)", fontSize: ".92rem" }}>{page.rating.count} değerlendirme</span>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                  {page.ratingBreakdown.map((n, i) => (
                    <li key={labels[i]} style={{ display: "grid", gridTemplateColumns: "14px 1fr 34px", gap: 8, alignItems: "center", fontSize: ".88rem" }}>
                      <span>{labels[i]}</span>
                      <span aria-hidden="true" style={{ height: 8, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: total ? `${(n / total) * 100}%` : "0%", background: "#f59e0b" }} />
                      </span>
                      <span style={{ color: "var(--muted)", textAlign: "right" }}>{n}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                {page.reviews.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--muted)" }}>Henüz değerlendirme yok. İlk yorumu siz yazın.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                    {page.reviews.map((r) => (
                      <li key={r.id} style={{ display: "grid", gap: 4, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <strong>{r.customerName}</strong>
                          <span style={{ color: "#f59e0b" }}>{stars(r.rating)}</span>
                        </div>
                        {r.body && <p style={{ margin: 0 }}>{r.body}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                <ReviewForm tenantId={tenantId} />
              </div>
            </div>
          </section>
        </div>
      </main>
      <style>{`
        @media (min-width: 980px) { .bp-grid { grid-template-columns: minmax(0, 1fr) 360px !important; } .bp-side { position: sticky; top: 90px; } }
        @media (min-width: 760px) { .rv-grid { grid-template-columns: 300px minmax(0, 1fr) !important; } }
      `}</style>
    </>
  );
}
