"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SECTOR_KEYS, SECTORS, type SectorKey } from "@/lib/sectors";

// Ana sayfa arama çubuğu: sektör seçilir, o sektörün firma listesine gidilir.
export function SearchBar() {
  const router = useRouter();
  const [sector, setSector] = useState<SectorKey>("dugun-salonu");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); router.push(`/randevu/${sector}`); }}
      role="search"
      style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 8, borderRadius: 18, background: "var(--surface)", maxWidth: 720 }}
    >
      <label style={{ display: "grid", flex: "1 1 220px", padding: "8px 14px", minWidth: 0 }}>
        <span style={{ fontSize: ".85rem", color: "var(--muted)", fontWeight: 700 }}>Ne arıyorsunuz?</span>
        <select value={sector} onChange={(e) => setSector(e.target.value as SectorKey)} style={{ border: 0, background: "transparent", font: "inherit", fontSize: "1rem", color: "var(--text)", padding: "4px 0", outline: "none" }}>
          {SECTOR_KEYS.map((k) => <option key={k} value={k}>{SECTORS[k].label}</option>)}
        </select>
      </label>
      <button type="submit" style={{ padding: "0 24px", minHeight: 52, borderRadius: 12, border: 0, background: "var(--plum-700)", color: "#fff", fontWeight: 700, fontSize: "1rem", cursor: "pointer" }}>
        Firmaları gör
      </button>
    </form>
  );
}
