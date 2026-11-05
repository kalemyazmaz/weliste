"use client";

import Link from "next/link";
import { useState } from "react";
import type { OrgEventRow } from "@/lib/org";

const STATUS: Record<string, string> = { taslak: "Taslak", onaylandi: "Onaylandı", tamamlandi: "Tamamlandı", iptal: "İptal" };
const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)", width: "100%" } as const;
const btn = { padding: "9px 14px", borderRadius: 12, border: 0, background: "var(--plum-700)", color: "#fff", cursor: "pointer", fontWeight: 700, font: "inherit" } as const;
const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

// Etkinlik listesi ve yeni etkinlik formu.
export function EventsManager({ tenantId, initialItems }: { tenantId: string; initialItems: OrgEventRow[] }) {
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/tenants/${tenantId}/org/events`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: f.get("title"), clientName: f.get("clientName"), clientPhone: f.get("clientPhone"), eventDate: f.get("eventDate"), location: f.get("location"), guestCount: f.get("guestCount") || null, budgetTl: f.get("budgetTl") || 0, status: f.get("status") }),
    });
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: "Etkinlik eklenemedi. Ad, tarih ve bütçe alanlarını kontrol edin." }); return; }
    form.reset();
    const r = await fetch(`/api/tenants/${tenantId}/org/events`, { cache: "no-store" });
    if (r.ok) setItems(((await r.json()) as { items: OrgEventRow[] }).items);
    setMsg({ ok: true, text: "Etkinlik eklendi." });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {msg && <p role="status" style={{ margin: 0, color: msg.ok ? "#067647" : "#b42318" }}>{msg.text}</p>}
      <form onSubmit={create} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end", padding: 18, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)" }}>
        <strong style={{ gridColumn: "1 / -1" }}>Yeni etkinlik</strong>
        <input name="title" required minLength={2} maxLength={160} placeholder="Etkinlik adı" style={input} />
        <input name="clientName" maxLength={120} placeholder="Müşteri adı" style={input} />
        <input name="clientPhone" placeholder="Müşteri telefonu" style={input} />
        <input name="eventDate" type="date" required style={input} aria-label="Etkinlik tarihi" />
        <input name="location" maxLength={200} placeholder="Mekân" style={input} />
        <input name="guestCount" type="number" min={1} max={50000} placeholder="Kişi sayısı" style={input} />
        <input name="budgetTl" type="number" min={0} step="any" placeholder="Bütçe (TL)" style={input} />
        <select name="status" defaultValue="taslak" style={input}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button type="submit" disabled={busy} style={btn}>Etkinlik ekle</button>
      </form>

      {items.length === 0 && <p style={{ margin: 0, color: "var(--muted)" }}>Henüz etkinlik yok.</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((x) => (
          <Link key={x.id} href={`/panel/${tenantId}/etkinlikler/${x.id}`} style={{ display: "grid", gap: 8, padding: 16, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", textDecoration: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong>{x.title}</strong>
              <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>{STATUS[x.status]} · {new Date(`${x.eventDate}T00:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "UTC" })}</span>
            </div>
            <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{x.clientName || "Müşteri adı yok"}{x.location && ` · ${x.location}`}{x.guestCount && ` · ${x.guestCount} kişi`}</span>
            <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>Görevler {x.taskDone}/{x.taskTotal} · Bütçe {tl(x.budgetTl)} · Gider {tl(x.costTotal)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
