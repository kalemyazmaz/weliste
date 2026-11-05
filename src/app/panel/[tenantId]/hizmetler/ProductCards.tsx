"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Ürünler: kasada gelir kalemi olarak satılan ürünler. Yalnızca sahip ekleyip silebilir.
export function ProductCards({ tenantId, products, isOwner }: { tenantId: string; products: Array<{ id: string; name: string; priceTl: number }>; isOwner: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/tenants/${tenantId}/products`;

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setError(null);
    const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.get("name"), priceTl: f.get("priceTl") }) });
    setBusy(false);
    if (!res.ok) { setError("Ürün eklenemedi. Ad ve fiyatı kontrol edin."); return; }
    form.reset();
    router.refresh();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`${name} silinsin mi?`)) return;
    setBusy(true); setError(null);
    const res = await fetch(`${base}/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    if (res.ok) router.refresh(); else setError("Ürün silinemedi.");
  }

  const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)" } as const;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {products.length === 0 ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>Henüz ürün yok. Ürünler kasada gelir kalemi olarak seçilebilir.</p>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {products.map((p) => (
            <article key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: 16, display: "grid", gap: 8 }}>
              <strong>{p.name}</strong>
              <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--subtle)", justifySelf: "start", fontSize: ".85rem" }}>{p.priceTl} TL</span>
              {isOwner && (
                <button type="button" disabled={busy} onClick={() => remove(p.id, p.name)} aria-label={`${p.name} sil`} style={{ justifySelf: "end", width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "#b42318", cursor: "pointer" }}>✕</button>
              )}
            </article>
          ))}
        </div>
      )}
      {isOwner && (
        <form onSubmit={add} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end", padding: 16, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)" }}>
          <label style={{ display: "grid", gap: 4, fontSize: ".82rem", color: "var(--muted)" }}>Ürün adı<input name="name" required minLength={2} placeholder="Saç bakım kremi" style={input} /></label>
          <label style={{ display: "grid", gap: 4, fontSize: ".82rem", color: "var(--muted)" }}>Fiyat (TL)<input name="priceTl" type="number" min={0} step="0.01" required style={input} /></label>
          <button type="submit" disabled={busy} style={{ padding: "10px 16px", borderRadius: 12, border: 0, background: "var(--plum-700)", color: "#fff", cursor: "pointer", fontWeight: 700 }}>Ürün ekle</button>
          {error && <p role="alert" style={{ margin: 0, color: "#b42318", gridColumn: "1 / -1" }}>{error}</p>}
        </form>
      )}
    </div>
  );
}
