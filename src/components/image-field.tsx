"use client";

import { useState } from "react";

// Görseli en uzun kenarı maxPx olacak şekilde küçültür ve JPEG data URL olarak döndürür (sığmazsa null).
export async function resizeToDataUrl(file: File, maxPx: number): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("load"));
      i.src = url;
    });
    const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    let data = c.toDataURL("image/jpeg", 0.85);
    if (data.length > 550000) data = c.toDataURL("image/jpeg", 0.6);
    return data.length > 550000 ? null : data;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Görsel seçici: seçilen görsel resizeToDataUrl ile küçültülüp kaydedilir.
export function ImageField({ value, onChange, maxPx = 512, label, aspect = "1 / 1", disabled }: {
  value: string | null; onChange: (v: string | null) => void; maxPx?: number; label: string; aspect?: string; disabled?: boolean;
}) {
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File) {
    setErr(null);
    const data = await resizeToDataUrl(file, maxPx);
    if (!data) { setErr("Görsel okunamadı veya çok büyük."); return; }
    onChange(data);
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>{label}</span>
      <div style={{ position: "relative", width: "100%", aspectRatio: aspect, borderRadius: 16, overflow: "hidden", background: "var(--subtle)", border: "1px solid var(--line)", display: "grid", placeItems: "center" }}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>Görsel yok</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
          Görsel seç
          <input type="file" accept="image/*" disabled={disabled} onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.currentTarget.value = ""; }} style={{ display: "none" }} />
        </label>
        {value && !disabled && <button type="button" onClick={() => onChange(null)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "#b42318", cursor: "pointer" }}>Kaldır</button>}
      </div>
      {err && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{err}</p>}
    </div>
  );
}
