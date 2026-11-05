"use client";

import { useState } from "react";

type Slot = "gunduz" | "gece";
interface Data { halls: Array<{ id: string; name: string }>; taken: Array<{ hallId: string | null; date: string; slot: Slot }> }

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const btn = { padding: "8px 12px", borderRadius: 12, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 700, font: "inherit" } as const;

function bounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}`, last, firstWeekday: (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7 };
}

// Müsaitlik: her gün ve seans için salon bazında dolu / boş. Fiyat ya da kişi bilgisi yoktur.
export function Availability({ tenantId, token, initialFrom, initialTo, initial }: { tenantId: string; token: string; initialFrom: string; initialTo: string; initial: Data }) {
  const [ym, setYm] = useState(initialFrom.slice(0, 7));
  const [data, setData] = useState<Data>(initial);
  const [loading, setLoading] = useState(false);
  const b = bounds(ym);

  async function go(delta: number) {
    const [y, m] = ym.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1 + delta, 1));
    const n = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
    const r = bounds(n);
    setLoading(true);
    const res = await fetch(`/api/public/tenants/${tenantId}/availability/${token}?from=${r.from}&to=${r.to}`, { cache: "no-store" });
    setLoading(false);
    if (res.ok) { setData(await res.json()); setYm(n); }
  }

  const cells: Array<string | null> = Array(b.firstWeekday).fill(null);
  for (let d = 1; d <= b.last; d++) cells.push(`${ym}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const isTaken = (hallId: string, date: string, slot: Slot) => data.taken.some((t) => t.hallId === hallId && t.date === date && t.slot === slot);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 16px 48px", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => go(-1)} disabled={loading} style={btn}>←</button>
        <strong style={{ minWidth: 160, textAlign: "center" }}>{MONTHS[Number(ym.slice(5)) - 1]} {ym.slice(0, 4)}</strong>
        <button type="button" onClick={() => go(1)} disabled={loading} style={btn}>→</button>
        <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>Boş seanslar için işletmeyle iletişime geçin.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
        {DAYS.map((d) => <div key={d} style={{ textAlign: "center", fontSize: ".78rem", color: "var(--muted)", fontWeight: 700 }}>{d}</div>)}
        {cells.map((d, i) => (
          <div key={i} style={{ minHeight: 84, padding: 6, borderRadius: 12, border: d ? "1px solid var(--line)" : "none", background: d ? "var(--surface)" : "transparent", display: "grid", gap: 4, alignContent: "start" }}>
            {d && <span style={{ fontWeight: 800, fontSize: ".85rem" }}>{Number(d.slice(8))}</span>}
            {d && data.halls.map((h) => (
              <div key={h.id} style={{ display: "grid", gap: 2 }}>
                {data.halls.length > 1 && <span style={{ fontSize: ".65rem", color: "var(--muted)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{h.name}</span>}
                <div style={{ display: "flex", gap: 3 }}>
                  {(["gunduz", "gece"] as Slot[]).map((s) => (
                    <span key={s} title={`${s === "gunduz" ? "Gündüz" : "Gece"}: ${isTaken(h.id, d, s) ? "dolu" : "boş"}`}
                      style={{ flex: 1, textAlign: "center", fontSize: ".65rem", fontWeight: 800, padding: "2px 0", borderRadius: 6, background: isTaken(h.id, d, s) ? "#EC806E" : "#D8F5F0", color: isTaken(h.id, d, s) ? "#fff" : "var(--text)" }}>
                      {s === "gunduz" ? "G" : "Ge"}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: ".85rem", color: "var(--muted)" }}>
        <span><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 4, background: "#D8F5F0", verticalAlign: "middle" }} /> Boş</span>
        <span><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 4, background: "#EC806E", verticalAlign: "middle" }} /> Dolu</span>
        <span>G: gündüz · Ge: gece</span>
      </div>
    </div>
  );
}
