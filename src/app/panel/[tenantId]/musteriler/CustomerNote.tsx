"use client";

import { useState } from "react";

// Müşteri notu: işletmenin kendi notu. Yalnızca işletme üyeleri görür ve düzenler.
export function CustomerNote({ tenantId, phone, initial }: { tenantId: string; phone: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setSaved(false); setError(null);
    const res = await fetch(`/api/tenants/${tenantId}/customers/${phone}/note`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: value }),
    });
    setBusy(false);
    if (res.ok) setSaved(true); else setError("Not kaydedilemedi.");
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} maxLength={2000} placeholder="Örn. Hassas cilt, tercih ettiği personel…" style={{ padding: 10, borderRadius: 10, border: "1px solid var(--border)", font: "inherit", resize: "vertical" }} />
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button type="button" disabled={busy} onClick={save} style={{ padding: "8px 14px", borderRadius: 10, border: 0, background: "var(--plum-700, var(--plum-700))", color: "#fff", cursor: "pointer" }}>{busy ? "Kaydediliyor…" : "Notu kaydet"}</button>
        {saved && <small style={{ color: "#067647" }}>Kaydedildi</small>}
        {error && <small style={{ color: "#b42318" }}>{error}</small>}
      </div>
    </div>
  );
}
