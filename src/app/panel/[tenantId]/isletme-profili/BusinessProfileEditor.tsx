"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resizeToDataUrl } from "@/components/image-field";
import { ImageCard } from "./ImageCard";
import { SECTORS, SECTOR_KEYS, type SectorKey } from "@/lib/sectors";
import type { ImageFit } from "@/lib/image-fit";

interface Profile {
  name: string; sector: string | null; logo: string | null; cover: string | null; phone: string; address: string; city: string;
  gallery: Array<{ id: string; data: string }>;
  rating: { average: number; count: number };
  reviews: Array<{ id: string; customerName: string; rating: number; body: string; status: string; createdAt: string }>;
  showServices: boolean; showPrices: boolean;
  logoFit: ImageFit | null; coverFit: ImageFit | null;
  amenities: string[];
}

const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)", width: "100%" } as const;
const card = { display: "grid", gap: 14, padding: 18, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)" } as const;

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, opacity: disabled ? 0.55 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
      <span>{label}</span>
      <input type="checkbox" role="switch" aria-checked={checked} checked={checked} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} style={{ width: 44, height: 24, accentColor: "var(--accent)" }} />
    </label>
  );
}

// İşletme profili: kapak, logo, temel bilgiler, hizmetler, galeri, puan ve yorumlar.
export function BusinessProfileEditor({ tenantId, profile, serviceCount }: { tenantId: string; profile: Profile; serviceCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function put(body: Record<string, unknown>, okText = "Kaydedildi.") {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/tenants/${tenantId}/business-profile`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) { setMsg({ ok: true, text: okText }); router.refresh(); return true; }
    setMsg({ ok: false, text: "Kaydedilemedi. Alanları kontrol edin." });
    return false;
  }

  async function addPhoto(data: string | null) {
    if (!data) return;
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/tenants/${tenantId}/gallery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: data }) });
    setBusy(false);
    if (res.ok) { router.refresh(); } else setMsg({ ok: false, text: "Fotoğraf eklenemedi (en fazla 30 fotoğraf)." });
  }

  async function removePhoto(id: string) {
    if (!window.confirm("Bu fotoğraf silinsin mi?")) return;
    setBusy(true);
    await fetch(`/api/tenants/${tenantId}/gallery/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    router.refresh();
  }

  async function setReview(id: string, status: "shown" | "hidden") {
    setBusy(true);
    await fetch(`/api/tenants/${tenantId}/reviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setBusy(false);
    router.refresh();
  }

  const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {msg && <p role="status" style={{ margin: 0, color: msg.ok ? "#067647" : "#b42318" }}>{msg.text}</p>}

      <section style={card}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Kapak fotoğrafı</h2>
        <ImageCard label="Kapak (geniş görsel önerilir)" aspect="16 / 6" maxPx={1200} value={profile.cover} fit={profile.coverFit} disabled={busy}
          onImageChange={(v) => put({ cover: v }, v ? "Kapak güncellendi." : "Kapak silindi.")}
          onFitSave={(f) => put({ coverFit: f }, "Kapak görünümü kaydedildi.")} />
      </section>

      <section style={{ ...card, gridTemplateColumns: "minmax(0, 220px) 1fr", alignItems: "start" }} className="bp-logo">
        <ImageCard label="Firma logosu" aspect="1 / 1" maxPx={400} value={profile.logo} fit={profile.logoFit} disabled={busy}
          onImageChange={(v) => put({ logo: v }, v ? "Logo güncellendi." : "Logo silindi.")}
          onFitSave={(f) => put({ logoFit: f }, "Logo görünümü kaydedildi.")} />
        <div style={{ display: "grid", gap: 4 }}>
          <strong style={{ fontSize: "1.15rem" }}>{profile.name}</strong>
          <span style={{ color: "var(--muted)" }}>{profile.sector && SECTOR_KEYS.includes(profile.sector as SectorKey) ? SECTORS[profile.sector as SectorKey].label : "Sektör seçilmedi"} · {profile.city}</span>
          <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>Puan: {profile.rating.count > 0 ? `${profile.rating.average.toFixed(1)} (${profile.rating.count} yorum)` : "Henüz yorum yok"}</span>
        </div>
      </section>

      <section style={card}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Temel bilgiler</h2>
        <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await put({ phone: f.get("phone"), address: f.get("address"), sector: f.get("sector"), amenities: String(f.get("amenities") ?? "").split(",") }); }} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6, fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>Telefon<input name="phone" defaultValue={profile.phone} placeholder="0532 000 00 00" style={input} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>Hizmet sektörü
            <select name="sector" defaultValue={profile.sector ?? "dugun-salonu"} style={input}>{SECTOR_KEYS.map((k) => <option key={k} value={k}>{SECTORS[k].label}</option>)}</select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: ".82rem", color: "var(--muted)", fontWeight: 700, gridColumn: "1 / -1" }}>Konum (adres)<input name="address" defaultValue={profile.address} placeholder="Mahalle, cadde, no, ilçe / il" style={input} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: ".82rem", color: "var(--muted)", fontWeight: 700, gridColumn: "1 / -1" }}>Olanaklar (virgülle ayırın)<input name="amenities" defaultValue={profile.amenities.join(", ")} placeholder="Otopark, bahçe, klima, engelli erişimi" style={input} /></label>
          <div style={{ gridColumn: "1 / -1" }}><button type="submit" disabled={busy} style={{ padding: "10px 16px", borderRadius: 12, border: 0, background: "var(--plum-700)", color: "#fff", cursor: "pointer", fontWeight: 700 }}>Bilgileri kaydet</button></div>
        </form>
      </section>

      <section style={card}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr auto", alignItems: "center" }}>
          <div><h2 style={{ margin: 0, fontSize: "1.05rem" }}>Hizmetler</h2><p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{serviceCount} hizmet tanımlı. Müşteriler randevu alırken bu hizmetlerden seçer.</p></div>
          <Link href={`/panel/${tenantId}/hizmetler`} style={{ color: "var(--accent)", fontWeight: 700 }}>Hizmetleri düzenle →</Link>
        </div>
        <div style={{ display: "grid", gap: 10, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <strong style={{ fontSize: ".92rem" }}>Müşteri sayfasında göster</strong>
          <Toggle label="Hizmet listesi" checked={profile.showServices} disabled={busy} onChange={(v) => put({ showServices: v }, "Hizmet görünürlüğü güncellendi.")} />
          <Toggle label="Fiyatlar" checked={profile.showPrices} disabled={busy || !profile.showServices} onChange={(v) => put({ showPrices: v }, "Fiyat görünürlüğü güncellendi.")} />
        </div>
      </section>

      <section style={card}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Fotoğraf galerisi ({profile.gallery.length}/30)</h2>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
          {profile.gallery.map((g) => (
            <div key={g.id} style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.data} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button type="button" onClick={() => removePhoto(g.id)} aria-label="Fotoğrafı sil" style={{ position: "absolute", top: 6, right: 6, width: 30, height: 30, borderRadius: 999, border: 0, background: "rgba(0,0,0,.6)", color: "#fff", cursor: "pointer" }}>✕</button>
            </div>
          ))}
          {profile.gallery.length < 30 && (
            <label style={{ aspectRatio: "1 / 1", borderRadius: 14, border: "2px dashed var(--line)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--muted)", fontWeight: 700 }}>
              + Fotoğraf
              <input type="file" accept="image/*" disabled={busy} style={{ display: "none" }} onChange={async (e) => {
                const f = e.target.files?.[0]; e.currentTarget.value = "";
                if (!f) return;
                addPhoto(await resizeToDataUrl(f, 800));
              }} />
            </label>
          )}
        </div>
      </section>

      <section style={card}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Puan ve yorumlar</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>{profile.rating.count > 0 ? `${stars(profile.rating.average)} ${profile.rating.average.toFixed(1)} · ${profile.rating.count} gösterilen yorum` : "Henüz yorum yok."}</p>
        {profile.reviews.length === 0 ? null : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
            {profile.reviews.map((r) => (
              <li key={r.id} style={{ display: "grid", gap: 6, padding: 14, borderRadius: 14, border: "1px solid var(--line)", opacity: r.status === "hidden" ? 0.55 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong>{r.customerName || "Müşteri"} <span style={{ color: "#f59e0b" }}>{stars(r.rating)}</span>{r.status === "pending" && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 999, background: "#FFF4D6", color: "#8A5A00", fontSize: ".78rem", fontWeight: 600 }}>Onay bekliyor</span>}</strong>
                  <button type="button" onClick={() => setReview(r.id, r.status === "shown" ? "hidden" : "shown")} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--line)", background: r.status === "pending" ? "var(--plum-700)" : "transparent", color: r.status === "pending" ? "#fff" : "var(--text)", cursor: "pointer" }}>{r.status === "shown" ? "Gizle" : r.status === "pending" ? "Yayınla" : "Göster"}</button>
                </div>
                {r.body && <p style={{ margin: 0 }}>{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
