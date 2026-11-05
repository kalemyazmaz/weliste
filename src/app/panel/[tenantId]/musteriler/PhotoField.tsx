"use client";

import { useState } from "react";

// Profil fotoğrafı: seçilen görsel 256 px'e küçültülür ve JPEG data URL olarak tutulur.
export function PhotoField({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File) {
    setErr(null);
    if (!file.type.startsWith("image/")) { setErr("Yalnızca görsel dosyası seçin."); return; }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("load"));
        i.src = url;
      });
      const scale = Math.min(1, 256 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL("image/jpeg", 0.85);
      if (data.length > 190000) data = canvas.toDataURL("image/jpeg", 0.6);
      if (data.length > 190000) { setErr("Fotoğraf çok büyük. Daha küçük bir görsel deneyin."); return; }
      onChange(data);
    } catch {
      setErr("Fotoğraf okunamadı.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Profil fotoğrafı" width={72} height={72} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line)" }} />
      ) : (
        <div aria-hidden="true" style={{ width: 72, height: 72, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--subtle)", color: "var(--muted)", fontSize: 24 }}>+</div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
          Fotoğraf seç
          <input type="file" accept="image/*" disabled={disabled} onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.currentTarget.value = ""; }} style={{ display: "none" }} />
        </label>
        {value && !disabled && <button type="button" onClick={() => onChange(null)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "#b42318", cursor: "pointer" }}>Kaldır</button>}
      </div>
      {err && <p role="alert" style={{ margin: 0, color: "#b42318", width: "100%" }}>{err}</p>}
    </div>
  );
}
