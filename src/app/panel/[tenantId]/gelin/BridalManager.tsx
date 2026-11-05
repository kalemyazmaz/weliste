"use client";

import { useState } from "react";
import { BRIDAL_STATUSES } from "@/lib/bridal-catalog";
import type { BridalFile } from "@/lib/bridal";

const STATUS: Record<string, string> = { planlandi: "Planlandı", deneme_yapildi: "Deneme yapıldı", gelin_gunu: "Gelin günü", tamamlandi: "Tamamlandı", iptal: "İptal" };
const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)", width: "100%" } as const;
const btn = { padding: "8px 12px", borderRadius: 12, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 700, font: "inherit" } as const;
const primary = { ...btn, border: 0, background: "var(--plum-700)", color: "#fff" } as const;
const dateText = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "UTC" }) : "Tarih yok");

// Gelin dosyaları: ekleme, durum değiştirme ve silme.
export function BridalManager({ tenantId, initialItems }: { tenantId: string; initialItems: BridalFile[] }) {
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const base = `/api/tenants/${tenantId}/bridal`;

  async function reload() {
    const r = await fetch(base, { cache: "no-store" });
    if (r.ok) setItems(((await r.json()) as { items: BridalFile[] }).items);
  }
  async function send(url: string, method: string, body: unknown, okText?: string) {
    setBusy(true); setMsg(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: "İşlem tamamlanamadı. Alanları kontrol edin." }); return false; }
    if (okText) setMsg({ ok: true, text: okText });
    await reload();
    return true;
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await send(base, "POST", { brideName: f.get("brideName"), phone: f.get("phone"), weddingDate: f.get("weddingDate") || null, trialDate: f.get("trialDate") || null, package: f.get("package"), note: f.get("note") }, "Gelin dosyası eklendi.");
    if (ok) e.currentTarget.reset();
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {msg && <p role="status" style={{ margin: 0, color: msg.ok ? "#067647" : "#b42318" }}>{msg.text}</p>}
      <form onSubmit={add} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", alignItems: "end", padding: 18, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)" }}>
        <strong style={{ gridColumn: "1 / -1" }}>Yeni gelin dosyası</strong>
        <input name="brideName" required minLength={2} maxLength={120} placeholder="Gelin adı" style={input} />
        <input name="phone" placeholder="Telefon" style={input} />
        <input name="weddingDate" type="date" style={input} aria-label="Düğün tarihi" />
        <input name="trialDate" type="date" style={input} aria-label="Deneme tarihi" />
        <input name="package" maxLength={120} placeholder="Paket (ör. Gelin + nişan)" style={input} />
        <input name="note" maxLength={1000} placeholder="Not" style={input} />
        <button type="submit" disabled={busy} style={primary}>Dosya ekle</button>
      </form>

      {items.length === 0 && <p style={{ margin: 0, color: "var(--muted)" }}>Henüz gelin dosyası yok.</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((x) => (
          <article key={x.id} style={{ display: "grid", gap: 8, padding: 16, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong>{x.brideName}</strong>
              <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>Düğün {dateText(x.weddingDate)} · Deneme {dateText(x.trialDate)}</span>
            </div>
            <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{x.phone ? <a href={`tel:${x.phone}`} style={{ color: "var(--accent)", fontWeight: 700 }}>{x.phone}</a> : "Telefon yok"}{x.package && ` · ${x.package}`}{x.note && ` · ${x.note}`}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {BRIDAL_STATUSES.map((s) => (
                <button key={s} type="button" disabled={busy || x.status === s} onClick={() => send(`${base}/${x.id}`, "PATCH", { status: s })}
                  style={{ ...btn, padding: "6px 10px", background: x.status === s ? "var(--plum-700)" : "transparent", color: x.status === s ? "#fff" : "var(--text)" }}>{STATUS[s]}</button>
              ))}
              <button type="button" disabled={busy} onClick={() => { if (window.confirm(`${x.brideName} dosyası silinsin mi?`)) send(`${base}/${x.id}`, "DELETE", {}); }} style={{ ...btn, padding: "6px 10px", color: "#b42318" }}>Sil</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
