"use client";

import { useMemo, useState } from "react";
import type { VenueHall, VenueSession } from "@/lib/venue";

type View = "ay" | "hafta" | "gun" | "ortak";
type Slot = "gunduz" | "gece";
const SLOT_LABEL: Record<Slot, string> = { gunduz: "GÜNDÜZ", gece: "GECE" };
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)", width: "100%" } as const;
const btn = { padding: "8px 12px", borderRadius: 12, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 700, font: "inherit" } as const;
const primary = { ...btn, border: 0, background: "var(--plum-700)", color: "#fff" } as const;
const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

// Tarih yardımcıları (YYYY-MM-DD, UTC)
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const monthOf = (s: string) => s.slice(0, 7);
function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}`, last, firstWeekday: (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7 };
}
function mondayOf(s: string) { const d = new Date(`${s}T00:00:00Z`); const wd = (d.getUTCDay() + 6) % 7; return addDays(s, -wd); }

// Seanslı takvim: ay / hafta / gün görünümü, salon seçimi ve salt okunur ortak takvim.
export function VenueCalendar({ tenantId, initialHalls, initialItems, initialDate }: { tenantId: string; initialHalls: VenueHall[]; initialItems: VenueSession[]; initialDate: string }) {
  const [halls, setHalls] = useState<VenueHall[]>(initialHalls);
  const [hallId, setHallId] = useState<string>(initialHalls[0]?.id ?? "");
  const [view, setView] = useState<View>("ay");
  const [anchor, setAnchor] = useState(initialDate);
  const [items, setItems] = useState<VenueSession[]>(initialItems);
  const [sel, setSel] = useState<{ date: string; slot: Slot; hallId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const base = `/api/tenants/${tenantId}/venue`;

  const range = useMemo(() => {
    if (view === "ay" || view === "ortak") { const b = monthBounds(monthOf(anchor)); return { from: b.from, to: b.to }; }
    if (view === "hafta") { const m = mondayOf(anchor); return { from: m, to: addDays(m, 6) }; }
    return { from: anchor, to: anchor };
  }, [view, anchor]);

  async function load(from: string, to: string, hid: string | "all") {
    const q = `from=${from}&to=${to}${hid === "all" ? "" : `&hallId=${hid}`}`;
    const res = await fetch(`${base}/sessions?${q}`, { cache: "no-store" });
    if (res.ok) setItems(((await res.json()) as { items: VenueSession[] }).items);
  }
  async function refresh(a = anchor, v = view, h = hallId) {
    const r = v === "ay" || v === "ortak" ? monthBounds(monthOf(a)) : null;
    const from = r ? r.from : v === "hafta" ? mondayOf(a) : a;
    const to = r ? r.to : v === "hafta" ? addDays(mondayOf(a), 6) : a;
    await load(from, to, v === "ortak" ? "all" : h);
  }
  function go(delta: number) {
    const next = view === "ay" || view === "ortak" ? (() => { const [y, m] = monthOf(anchor).split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + delta, 1)); return iso(d); })()
      : view === "hafta" ? addDays(anchor, 7 * delta) : addDays(anchor, delta);
    setAnchor(next); setSel(null); setMsg(null);
    refresh(next, view, hallId);
  }
  function changeView(v: View) { setView(v); setSel(null); setMsg(null); refresh(anchor, v, hallId); }
  function changeHall(h: string) { setHallId(h); setSel(null); refresh(anchor, view, h); }

  const hallName = (id: string | null) => halls.find((h) => h.id === id)?.name ?? "Salon";
  const visible = view === "ortak" ? items : items.filter((x) => x.hallId === hallId);
  const find = (date: string, slot: string, hid: string) => items.find((x) => x.date === date && x.slot === slot && x.hallId === hid && x.status === "aktif") ?? null;
  const active = visible.filter((x) => x.status === "aktif");
  const totalPrice = active.reduce((a, x) => a + x.priceTl, 0);
  const totalDeposit = active.reduce((a, x) => a + x.depositTl, 0);
  const days = useMemo(() => {
    if (view === "ay" || view === "ortak") {
      const b = monthBounds(monthOf(anchor));
      const cells: Array<string | null> = Array(b.firstWeekday).fill(null);
      for (let d = 1; d <= b.last; d++) cells.push(`${monthOf(anchor)}-${String(d).padStart(2, "0")}`);
      while (cells.length % 7 !== 0) cells.push(null);
      return cells;
    }
    if (view === "hafta") { const m = mondayOf(anchor); return Array.from({ length: 7 }, (_, i) => addDays(m, i)); }
    return [anchor];
  }, [view, anchor]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sel) return;
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg(null);
    const res = await fetch(`${base}/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hallId: sel.hallId, date: sel.date, slot: sel.slot, coupleName: f.get("coupleName"), phone: f.get("phone"), guestCount: f.get("guestCount") || null, priceTl: f.get("priceTl") || 0, depositTl: f.get("depositTl") || 0, note: f.get("note") }) });
    setBusy(false);
    if (res.status === 409) { setMsg({ ok: false, text: "Bu seans bu salonda zaten dolu." }); await refresh(); return; }
    if (!res.ok) { setMsg({ ok: false, text: "Kayıt yapılamadı. Çift adını ve fiyat / kapora alanlarını kontrol edin." }); return; }
    setMsg({ ok: true, text: "Seans kaydedildi." }); setSel(null); await refresh();
  }

  async function update(id: string, body: Record<string, unknown>, okText: string) {
    setBusy(true); setMsg(null);
    const res = await fetch(`${base}/sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.status === 409) { setMsg({ ok: false, text: "Bu seans başka bir kayıtla dolu; önce o kaydı iptal edin." }); return; }
    if (!res.ok) { setMsg({ ok: false, text: "Güncellenemedi." }); return; }
    setMsg({ ok: true, text: okText }); setSel(null); await refresh();
  }

  async function addHall(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg(null);
    const res = await fetch(`${base}/halls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.get("name"), capacity: f.get("capacity") || null }) });
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: "Salon eklenemedi. Adı kontrol edin." }); return; }
    e.currentTarget.reset();
    const r = await fetch(`${base}/halls`, { cache: "no-store" });
    if (r.ok) setHalls(((await r.json()) as { items: VenueHall[] }).items);
    setMsg({ ok: true, text: "Salon eklendi." });
  }

  const selectedSession = sel ? find(sel.date, sel.slot, sel.hallId) : null;
  const title = view === "ay" || view === "ortak" ? `${MONTHS[Number(monthOf(anchor).slice(5)) - 1]} ${monthOf(anchor).slice(0, 4)}` : view === "hafta" ? `${days[0]} – ${days[6]}` : anchor;
  const hallForNew = sel?.hallId ?? hallId;
  const dayList = days.filter((d): d is string => d !== null);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["ay", "hafta", "gun", "ortak"] as View[]).map((v) => (
            <button key={v} type="button" onClick={() => changeView(v)} style={{ ...btn, background: view === v ? "var(--plum-700)" : "transparent", color: view === v ? "#fff" : "var(--text)" }}>
              {v === "ay" ? "Ay" : v === "hafta" ? "Hafta" : v === "gun" ? "Gün" : "Ortak takvim"}
            </button>
          ))}
        </div>
        {view !== "ortak" && (
          <select value={hallId} onChange={(e) => changeHall(e.target.value)} aria-label="Salon" style={{ ...input, width: "auto", minWidth: 180 }}>
            {halls.map((h) => <option key={h.id} value={h.id}>{h.name}{h.active ? "" : " (pasif)"}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={() => go(-1)} aria-label="Önceki" style={btn}>←</button>
          <strong style={{ minWidth: 160, textAlign: "center" }}>{title}</strong>
          <button type="button" onClick={() => go(1)} aria-label="Sonraki" style={btn}>→</button>
        </div>
        <div style={{ color: "var(--muted)", fontSize: ".9rem" }}>{active.length} seans · toplam {tl(totalPrice)} · kapora {tl(totalDeposit)}</div>
      </div>
      {msg && <p role="status" style={{ margin: 0, color: msg.ok ? "#067647" : "#b42318" }}>{msg.text}</p>}

      {view === "ortak" ? (
        <div style={{ overflowX: "auto", borderRadius: 16, border: "1px solid var(--line)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
            <thead><tr style={{ background: "var(--subtle)", textAlign: "left" }}><th style={{ padding: 10 }}>Tarih</th><th style={{ padding: 10 }}>Salon</th><th style={{ padding: 10 }}>Gündüz</th><th style={{ padding: 10 }}>Gece</th></tr></thead>
            <tbody>
              {dayList.map((d) => halls.filter((h) => h.active).map((h) => (
                <tr key={`${d}-${h.id}`} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: 10, whiteSpace: "nowrap" }}>{d}</td>
                  <td style={{ padding: 10 }}>{h.name}</td>
                  {(["gunduz", "gece"] as Slot[]).map((s) => { const x = find(d, s, h.id); return <td key={s} style={{ padding: 10, color: x ? "var(--text)" : "var(--muted)", background: x ? "#D8F5F0" : "transparent" }}>{x ? x.coupleName : "Boş"}</td>; })}
                </tr>
              )))}
            </tbody>
          </table>
          <p style={{ margin: 0, padding: 10, color: "var(--muted)", fontSize: ".85rem" }}>Salt okunur görünüm. Seans eklemek veya düzenlemek için salon seçip Ay, Hafta veya Gün görünümüne geçin.</p>
        </div>
      ) : view === "ay" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
          {DAYS.map((d) => <div key={d} style={{ textAlign: "center", fontSize: ".78rem", color: "var(--muted)", fontWeight: 700, padding: "4px 0" }}>{d}</div>)}
          {days.map((d, i) => (
            <div key={i} style={{ minHeight: 96, padding: 6, borderRadius: 12, border: "1px solid var(--line)", background: d ? "var(--surface)" : "transparent", display: "grid", gap: 4, alignContent: "start" }}>
              {d && <span style={{ fontWeight: 800, fontSize: ".9rem" }}>{Number(d.slice(8))}</span>}
              {d && (["gunduz", "gece"] as Slot[]).map((slot) => <SlotButton key={slot} s={find(d, slot, hallId)} slot={slot} selected={sel?.date === d && sel?.slot === slot && sel?.hallId === hallId} onPick={() => { setSel({ date: d, slot, hallId }); setMsg(null); }} compact />)}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: view === "hafta" ? "repeat(7, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: 8 }}>
          {dayList.map((d) => (
            <div key={d} style={{ padding: 10, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)", display: "grid", gap: 8, alignContent: "start" }}>
              <strong style={{ fontSize: ".9rem" }}>{view === "gun" ? d : `${Number(d.slice(8))} · ${DAYS[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7]}`}</strong>
              {(["gunduz", "gece"] as Slot[]).map((slot) => <SlotButton key={slot} s={find(d, slot, hallId)} slot={slot} selected={sel?.date === d && sel?.slot === slot && sel?.hallId === hallId} onPick={() => { setSel({ date: d, slot, hallId }); setMsg(null); }} />)}
            </div>
          ))}
        </div>
      )}

      {view !== "ortak" && sel && !selectedSession && (
        <form key={`${sel.date}-${sel.slot}-${hallForNew}`} onSubmit={create} style={{ display: "grid", gap: 12, padding: 18, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", alignItems: "end" }}>
          <strong style={{ gridColumn: "1 / -1" }}>Yeni seans: {sel.date} · {SLOT_LABEL[sel.slot]} · {hallName(hallForNew)}</strong>
          <input name="coupleName" required minLength={2} maxLength={120} placeholder="Çift adı" style={input} />
          <input name="phone" placeholder="Telefon" style={input} />
          <input name="guestCount" type="number" min={1} max={5000} placeholder="Misafir sayısı" style={input} />
          <input name="priceTl" type="number" min={0} step="any" placeholder="Fiyat (TL)" style={input} />
          <input name="depositTl" type="number" min={0} step="any" placeholder="Kapora (TL)" style={input} />
          <input name="note" maxLength={1000} placeholder="Not" style={input} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={busy} style={primary}>Seansı kaydet</button>
            <button type="button" onClick={() => setSel(null)} style={btn}>Vazgeç</button>
          </div>
        </form>
      )}

      {view !== "ortak" && sel && selectedSession && (
        <form key={selectedSession.id} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); update(selectedSession.id, { coupleName: f.get("coupleName"), phone: f.get("phone"), guestCount: f.get("guestCount") || null, priceTl: f.get("priceTl") || 0, depositTl: f.get("depositTl") || 0, note: f.get("note") }, "Seans güncellendi."); }}
          style={{ display: "grid", gap: 12, padding: 18, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", alignItems: "end" }}>
          <strong style={{ gridColumn: "1 / -1" }}>{selectedSession.date} · {SLOT_LABEL[selectedSession.slot]} · {hallName(selectedSession.hallId)}</strong>
          <input name="coupleName" required minLength={2} maxLength={120} defaultValue={selectedSession.coupleName} style={input} />
          <input name="phone" defaultValue={selectedSession.phone} placeholder="Telefon" style={input} />
          <input name="guestCount" type="number" min={1} max={5000} defaultValue={selectedSession.guestCount ?? ""} placeholder="Misafir sayısı" style={input} />
          <input name="priceTl" type="number" min={0} step="any" defaultValue={selectedSession.priceTl} style={input} />
          <input name="depositTl" type="number" min={0} step="any" defaultValue={selectedSession.depositTl} style={input} />
          <input name="note" maxLength={1000} defaultValue={selectedSession.note} placeholder="Not" style={input} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" disabled={busy} style={primary}>Kaydet</button>
            <button type="button" disabled={busy} onClick={() => update(selectedSession.id, { status: "iptal" }, "Seans iptal edildi; slot yeniden açıldı.")} style={{ ...btn, color: "#b42318" }}>Seansı iptal et</button>
            <button type="button" onClick={() => setSel(null)} style={btn}>Kapat</button>
          </div>
        </form>
      )}

      <section style={{ display: "grid", gap: 10, padding: 18, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)" }}>
        <strong>Salonlar</strong>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          {halls.map((h) => <li key={h.id} style={{ color: h.active ? "var(--text)" : "var(--muted)" }}>{h.name}{h.capacity ? ` · ${h.capacity} kişi` : ""}{h.active ? "" : " · pasif"}</li>)}
        </ul>
        <form onSubmit={addHall} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input name="name" required minLength={2} maxLength={80} placeholder="Yeni salon adı" style={{ ...input, width: "auto", flex: "1 1 180px" }} />
          <input name="capacity" type="number" min={1} max={5000} placeholder="Kapasite" style={{ ...input, width: 120 }} />
          <button type="submit" disabled={busy} style={btn}>Salon ekle</button>
        </form>
      </section>
    </div>
  );
}

function SlotButton({ s, slot, selected, onPick, compact }: { s: VenueSession | null; slot: Slot; selected: boolean; onPick: () => void; compact?: boolean }) {
  return (
    <button type="button" onClick={onPick}
      style={{ textAlign: "left", padding: compact ? "4px 6px" : "10px 12px", borderRadius: 10, border: selected ? "2px solid var(--accent)" : "1px solid var(--line)", background: s ? "#D8F5F0" : "transparent", color: s ? "var(--text)" : "var(--muted)", cursor: "pointer", font: "inherit", fontSize: compact ? ".72rem" : ".9rem", overflow: "hidden" }}>
      <span style={{ display: "block", fontWeight: 800, letterSpacing: ".04em" }}>{SLOT_LABEL[slot]}</span>
      <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s ? s.coupleName : "+ Ekle"}</span>
    </button>
  );
}
