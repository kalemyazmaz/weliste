"use client";

import Link from "next/link";
import { useState } from "react";

// Müşterinin gördüğü randevu sayfasının canlı önizlemesi. Yayında değilse sayfa müşteriye kapalıdır.
export function PublicPreview({ src, published }: { src: string; published: boolean }) {
  const [width, setWidth] = useState<"phone" | "desktop">("phone");
  const btn = (active: boolean) => ({
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid var(--line)",
    background: active ? "var(--plum-700)" : "transparent",
    color: active ? "#fff" : "var(--text)",
    cursor: "pointer",
    font: "inherit",
    fontSize: ".85rem",
  } as const);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={btn(width === "phone")} onClick={() => setWidth("phone")}>Telefon</button>
          <button type="button" style={btn(width === "desktop")} onClick={() => setWidth("desktop")}>Masaüstü</button>
        </div>
        <Link href={src} target="_blank" rel="noopener noreferrer">Yeni sekmede aç ↗</Link>
      </div>
      {!published && (
        <p role="status" style={{ margin: 0, padding: 12, borderRadius: 12, background: "var(--gold-100)", color: "var(--text)" }}>
          Profil yayında değil. Müşteriler bu sayfayı göremez; önizleme yalnızca düzeni gösterir. Yayınlamak için yukarıdaki profil formunda “Profili yayınla” seçeneğini işaretleyip kaydedin.
        </p>
      )}
      <div style={{ display: "flex", justifyContent: "center", padding: 12, borderRadius: 16, background: "var(--subtle)", border: "1px solid var(--line)" }}>
        <iframe
          src={src}
          title="Müşteri sayfası önizlemesi"
          style={{
            width: width === "phone" ? 390 : "100%",
            maxWidth: "100%",
            height: width === "phone" ? 680 : 720,
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "var(--bg)",
            transition: "width .2s ease",
          }}
        />
      </div>
    </div>
  );
}
