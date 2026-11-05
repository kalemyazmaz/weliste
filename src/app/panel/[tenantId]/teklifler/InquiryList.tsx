"use client";

import { useState } from "react";
import type { VenueInquiry } from "@/lib/venue";

const STATUS: Record<VenueInquiry["status"], string> = { yeni: "Yeni", teklif_verildi: "Teklif verildi", kapandi: "Kapandı" };
const card = { display: "grid", gap: 10, padding: 16, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)" } as const;
const btn = { padding: "7px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 700, font: "inherit", fontSize: ".85rem" } as const;

// Teklif talepleri: müşterinin sitenizden gönderdiği talepler ve durum takibi.
export function InquiryList({ tenantId, initialItems }: { tenantId: string; initialItems: VenueInquiry[] }) {
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function setStatus(id: string, status: VenueInquiry["status"]) {
    setBusy(id); setMsg(null);
    const res = await fetch(`/api/tenants/${tenantId}/venue/inquiries/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setBusy(null);
    if (!res.ok) { setMsg("Durum güncellenemedi."); return; }
    setItems((cur) => cur.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  if (items.length === 0) return <p style={{ margin: 0, color: "var(--muted)" }}>Henüz teklif talebi yok. Talepler, sitenizdeki teklif formundan geldiğinde burada görünür.</p>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {msg && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{msg}</p>}
      {items.map((x) => (
        <article key={x.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <strong>{x.name}</strong>
            <span style={{ color: "var(--muted)", fontSize: ".85rem" }}>{STATUS[x.status]} · {new Date(x.createdAt).toLocaleDateString("tr-TR")}</span>
          </div>
          <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>
            <a href={`tel:${x.phone}`} style={{ color: "var(--accent)", fontWeight: 700 }}>{x.phone}</a>
            {x.eventDate && <> · Düğün tarihi: {new Date(`${x.eventDate}T00:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "UTC" })}</>}
            {x.guestCount && <> · {x.guestCount} misafir</>}
          </span>
          {x.message && <p style={{ margin: 0 }}>{x.message}</p>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["yeni", "teklif_verildi", "kapandi"] as const).map((s) => (
              <button key={s} type="button" disabled={busy === x.id || x.status === s} onClick={() => setStatus(x.id, s)} style={{ ...btn, background: x.status === s ? "var(--plum-700)" : "transparent", color: x.status === s ? "#fff" : "var(--text)" }}>{STATUS[s]}</button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
