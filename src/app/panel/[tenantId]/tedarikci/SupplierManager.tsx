"use client";

import { useState } from "react";
import type { VenueSupplier } from "@/lib/venue";

const CATS: Record<string, string> = { muzik: "Müzik", fotograf: "Fotoğraf", cicek: "Çiçek", yemek: "Yemek", susleme: "Süsleme", diger: "Diğer" };
const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)", width: "100%" } as const;
const btn = { padding: "8px 12px", borderRadius: 12, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 700, font: "inherit" } as const;
const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

// Tedarikçi listesi: ekleme, düzenleme ve silme. Kategoriye göre gruplanmış görünüm değil, sıralı liste.
export function SupplierManager({ tenantId, initialItems }: { tenantId: string; initialItems: VenueSupplier[] }) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/tenants/${tenantId}/venue/suppliers`;

  async function reload() {
    const r = await fetch(base, { cache: "no-store" });
    if (r.ok) setItems(((await r.json()) as { items: VenueSupplier[] }).items);
  }
  async function save(e: React.FormEvent<HTMLFormElement>, id: string | null) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg(null);
    const res = await fetch(id ? `${base}/${id}` : base, { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.get("name"), category: f.get("category"), phone: f.get("phone"), costTl: f.get("costTl") || 0, note: f.get("note") }) });
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: "Kaydedilemedi. Ad, kategori ve tutarı kontrol edin." }); return; }
    setEditing(null); setMsg({ ok: true, text: id ? "Tedarikçi güncellendi." : "Tedarikçi eklendi." });
    await reload();
  }
  async function remove(id: string) {
    if (!window.confirm("Bu tedarikçi silinsin mi?")) return;
    setBusy(true);
    await fetch(`${base}/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    await reload();
  }

  const form = (item: VenueSupplier | null) => (
    <form onSubmit={(e) => save(e, item?.id ?? null)} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end", padding: 16, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)" }}>
      <input name="name" required minLength={2} maxLength={120} defaultValue={item?.name ?? ""} placeholder="Firma / kişi adı" style={input} />
      <select name="category" defaultValue={item?.category ?? "diger"} style={input}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <input name="phone" defaultValue={item?.phone ?? ""} placeholder="Telefon" style={input} />
      <input name="costTl" type="number" min={0} step="any" defaultValue={item?.costTl ?? ""} placeholder="Tutar (TL)" style={input} />
      <input name="note" maxLength={500} defaultValue={item?.note ?? ""} placeholder="Not" style={input} />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} style={{ ...btn, background: "var(--plum-700)", color: "#fff", border: 0 }}>{item ? "Kaydet" : "Tedarikçi ekle"}</button>
        {item && <button type="button" onClick={() => setEditing(null)} style={btn}>Vazgeç</button>}
      </div>
    </form>
  );

  const total = items.reduce((a, x) => a + x.costTl, 0);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {msg && <p role="status" style={{ margin: 0, color: msg.ok ? "#067647" : "#b42318" }}>{msg.text}</p>}
      <p style={{ margin: 0, color: "var(--muted)" }}>{items.length} tedarikçi · toplam sözleşme tutarı {tl(total)}</p>
      {!editing && form(null)}
      <div style={{ display: "grid", gap: 10 }}>
        {items.length === 0 && <p style={{ margin: 0, color: "var(--muted)" }}>Henüz tedarikçi yok.</p>}
        {items.map((x) => editing === x.id ? <div key={x.id}>{form(x)}</div> : (
          <article key={x.id} style={{ display: "grid", gap: 6, padding: 16, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong>{x.name}</strong>
              <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{CATS[x.category] ?? x.category} · {tl(x.costTl)}</span>
            </div>
            <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{x.phone ? <a href={`tel:${x.phone}`} style={{ color: "var(--accent)", fontWeight: 700 }}>{x.phone}</a> : "Telefon yok"}{x.note && <> · {x.note}</>}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setEditing(x.id)} style={btn}>Düzenle</button>
              <button type="button" disabled={busy} onClick={() => remove(x.id)} style={{ ...btn, color: "#b42318" }}>Sil</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
