"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BUTTON_RADII, DISPLAY_FONTS, MODES, SANS_FONTS, type ThemeSettings } from "@/lib/site-defaults";
import { adminCall, card, input, label, primary } from "../ui";

const PALETTE_LABELS: Array<[keyof ThemeSettings["light"], string]> = [
  ["primary", "Birincil (düğme)"], ["accent", "Vurgu (bağlantı)"], ["bg", "Zemin"], ["surface", "Kart yüzeyi"], ["text", "Metin"], ["muted", "İkincil metin"],
];
const MODE_LABELS: Record<string, string> = { system: "Sistem", light: "Açık", dark: "Koyu" };
const RADIUS_LABELS: Record<string, string> = { square: "Köşeli", soft: "Yumuşak", pill: "Tam yuvarlak" };

export function ThemeEditor({ theme }: { theme: ThemeSettings }) {
  const router = useRouter();
  const [t, setT] = useState(theme);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    const r = await adminCall("/api/admin/settings/theme", "PUT", t);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Site ayarları kaydedildi." } : { ok: false, text: r.text });
    if (r.ok) router.refresh();
  }

  const palette = (mode: "light" | "dark") => (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
      {PALETTE_LABELS.map(([k, name]) => (
        <label key={k} style={label}>{name}
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={t[mode][k]} onChange={(e) => setT({ ...t, [mode]: { ...t[mode], [k]: e.target.value } })} aria-label={`${mode} ${name}`} style={{ width: 44, height: 36, border: 0, background: "none", padding: 0 }} />
            <code style={{ color: "var(--muted)" }}>{t[mode][k]}</code>
          </span>
        </label>
      ))}
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={card}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Yazı tipleri ve düğmeler</h2>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label style={label}>Pazarlama başlığı
            <select value={t.displayFont} onChange={(e) => setT({ ...t, displayFont: e.target.value as ThemeSettings["displayFont"] })} style={input}>{DISPLAY_FONTS.map((f) => <option key={f}>{f}</option>)}</select>
          </label>
          <label style={label}>Arayüz yazısı
            <select value={t.sansFont} onChange={(e) => setT({ ...t, sansFont: e.target.value as ThemeSettings["sansFont"] })} style={input}>{SANS_FONTS.map((f) => <option key={f}>{f}</option>)}</select>
          </label>
          <label style={label}>Düğme biçimi
            <select value={t.buttonRadius} onChange={(e) => setT({ ...t, buttonRadius: e.target.value as ThemeSettings["buttonRadius"] })} style={input}>{BUTTON_RADII.map((r) => <option key={r} value={r}>{RADIUS_LABELS[r]}</option>)}</select>
          </label>
          <label style={label}>Varsayılan görünüm
            <select value={t.defaultMode} onChange={(e) => setT({ ...t, defaultMode: e.target.value as ThemeSettings["defaultMode"] })} style={input}>{MODES.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}</select>
          </label>
        </div>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: ".88rem" }}>Ziyaretçi kendi tercihini seçtiyse, bu tercih öncelikli olur. Seçilmediyse varsayılan görünüm kullanılır.</p>
      </section>
      <section style={card}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Açık mod renkleri</h2>
        {palette("light")}
      </section>
      <section style={card}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Koyu mod renkleri</h2>
        {palette("dark")}
      </section>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={save} disabled={busy} style={primary}>{busy ? "Kaydediliyor…" : "Ayarları kaydet"}</button>
        {msg && <span role="status" style={{ color: msg.ok ? "#067647" : "#b42318" }}>{msg.text}</span>}
      </div>
    </div>
  );
}
