"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EVENT_STATUSES, COST_CATEGORIES } from "@/lib/org-catalog";
import type { OrgCost, OrgEventRow, OrgTask } from "@/lib/org";

const STATUS: Record<string, string> = { taslak: "Taslak", onaylandi: "Onaylandı", tamamlandi: "Tamamlandı", iptal: "İptal" };
const CAT: Record<string, string> = { tedarikci: "Tedarikçi", ekipman: "Ekipman", ulasim: "Ulaşım", yemek: "Yemek", diger: "Diğer" };
const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)", width: "100%" } as const;
const btn = { padding: "9px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 700, font: "inherit" } as const;
const primary = { ...btn, border: 0, background: "var(--plum-700)", color: "#fff" } as const;
const card = { display: "grid", gap: 12, padding: 18, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)" } as const;
const tl = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

interface Props {
  tenantId: string;
  detail: { event: OrgEventRow; tasks: OrgTask[]; costs: OrgCost[]; staff: Array<{ id: string; name: string }> };
  tasksOn: boolean;
  budgetOn: boolean;
  isOwner: boolean;
}

// Etkinlik yönetimi: bilgiler, ekip ataması, görevler ve bütçe. Her değişiklik sunucuya gider, sayfa yenilenir.
export function EventDetail({ tenantId, detail, tasksOn, budgetOn, isOwner }: Props) {
  const router = useRouter();
  const { event: ev, tasks, costs, staff } = detail;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const base = `/api/tenants/${tenantId}`;

  async function call(url: string, method: string, body: unknown, okText?: string) {
    setBusy(true); setMsg(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { fields?: string[] };
      setMsg({ ok: false, text: data.fields?.length ? `Hatalı alan: ${data.fields.join(", ")}` : "İşlem tamamlanamadı." });
      return false;
    }
    if (okText) setMsg({ ok: true, text: okText });
    router.refresh();
    return true;
  }

  const costTotal = costs.reduce((a, c) => a + c.amountTl, 0);
  const costPaid = costs.filter((c) => c.paid).reduce((a, c) => a + c.amountTl, 0);
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {msg && <p role="status" style={{ margin: 0, color: msg.ok ? "#067647" : "#b42318" }}>{msg.text}</p>}
      <Link href={`/panel/${tenantId}/etkinlikler`} style={{ color: "var(--accent)", fontWeight: 700, justifySelf: "start" }}>← Etkinlikler</Link>

      <form key={ev.id + ev.title + ev.status} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); call(`${base}/org/events/${ev.id}`, "PATCH", { title: f.get("title"), clientName: f.get("clientName"), clientPhone: f.get("clientPhone"), eventDate: f.get("eventDate"), location: f.get("location"), guestCount: f.get("guestCount") || null, budgetTl: f.get("budgetTl") || 0, status: f.get("status"), note: f.get("note") }, "Etkinlik güncellendi."); }}
        style={{ ...card, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", alignItems: "end" }}>
        <strong style={{ gridColumn: "1 / -1" }}>Etkinlik bilgileri</strong>
        <input name="title" required minLength={2} maxLength={160} defaultValue={ev.title} style={input} aria-label="Etkinlik adı" />
        <input name="clientName" maxLength={120} defaultValue={ev.clientName} placeholder="Müşteri adı" style={input} />
        <input name="clientPhone" defaultValue={ev.clientPhone} placeholder="Telefon" style={input} />
        <input name="eventDate" type="date" required defaultValue={ev.eventDate} style={input} aria-label="Etkinlik tarihi" />
        <input name="location" maxLength={200} defaultValue={ev.location} placeholder="Mekân" style={input} />
        <input name="guestCount" type="number" min={1} max={50000} defaultValue={ev.guestCount ?? ""} placeholder="Kişi sayısı" style={input} />
        <input name="budgetTl" type="number" min={0} step="any" defaultValue={ev.budgetTl} placeholder="Bütçe (TL)" style={input} />
        <select name="status" defaultValue={ev.status} style={input}>{EVENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}</select>
        <textarea name="note" rows={2} maxLength={1000} defaultValue={ev.note} placeholder="Not" style={{ ...input, gridColumn: "1 / -1" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" disabled={busy} style={primary}>Kaydet</button>
          <button type="button" disabled={busy} onClick={() => { if (window.confirm("Etkinlik ve tüm görev / gider kayıtları silinsin mi?")) call(`${base}/org/events/${ev.id}`, "DELETE", {}).then((ok) => ok && router.push(`/panel/${tenantId}/etkinlikler`)); }} style={{ ...btn, color: "#b42318" }}>Etkinliği sil</button>
        </div>
      </form>

      <section style={card}>
        <strong>Ekip</strong>
        {staff.length === 0 ? <p style={{ margin: 0, color: "var(--muted)" }}>Personel kaydı yok. Önce Personel sayfasından ekleyin.</p> : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {staff.map((p) => {
              const on = ev.staffIds.includes(p.id);
              return (
                <button key={p.id} type="button" disabled={busy} aria-pressed={on} onClick={() => {
                  const next = on ? ev.staffIds.filter((x) => x !== p.id) : [...ev.staffIds, p.id];
                  call(`${base}/org/events/${ev.id}/staff`, "PUT", { staffIds: next });
                }} style={{ ...btn, background: on ? "var(--accent)" : "transparent", color: on ? "var(--text)" : "var(--text)" }}>{p.name}</button>
              );
            })}
          </div>
        )}
      </section>

      {tasksOn && (
        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <strong>Görevler</strong>
            <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{doneCount}/{tasks.length} tamamlandı</span>
          </div>
          {tasks.length === 0 && <p style={{ margin: 0, color: "var(--muted)" }}>Henüz görev yok.</p>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {tasks.map((t) => {
              const assignee = staff.find((p) => p.id === t.assigneeId)?.name;
              return (
                <li key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, borderRadius: 12, border: "1px solid var(--line)" }}>
                  <input type="checkbox" checked={t.done} disabled={busy} aria-label={`${t.title} tamamlandı`} onChange={(e) => call(`${base}/org/tasks/${t.id}`, "PATCH", { done: e.currentTarget.checked })} />
                  <span style={{ flex: 1, textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--muted)" : "var(--text)" }}>
                    {t.title}
                    <span style={{ display: "block", color: "var(--muted)", fontSize: ".82rem" }}>{t.dueDate ? new Date(`${t.dueDate}T00:00:00Z`).toLocaleDateString("tr-TR", { timeZone: "UTC" }) : "Tarihsiz"}{assignee ? ` · ${assignee}` : ""}</span>
                  </span>
                  <button type="button" disabled={busy} aria-label={`${t.title} sil`} onClick={() => call(`${base}/org/tasks/${t.id}`, "DELETE", {})} style={{ ...btn, padding: "6px 10px", color: "#b42318" }}>✕</button>
                </li>
              );
            })}
          </ul>
          <form key={`task-${tasks.length}`} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); call(`${base}/org/events/${ev.id}/tasks`, "POST", { title: f.get("title"), dueDate: f.get("dueDate") || null, assigneeId: f.get("assigneeId") || null }).then((ok) => ok && e.currentTarget.reset()); }}
            style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", alignItems: "end" }}>
            <input name="title" required minLength={2} maxLength={160} placeholder="Yeni görev" style={input} />
            <input name="dueDate" type="date" style={input} aria-label="Son tarih" />
            <select name="assigneeId" defaultValue="" style={input}><option value="">Sorumlu yok</option>{staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <button type="submit" disabled={busy} style={primary}>Görev ekle</button>
          </form>
        </section>
      )}

      {budgetOn && (
        <section style={card}>
          <strong>Bütçe</strong>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <Stat label="Bütçe" value={tl(ev.budgetTl)} />
            <Stat label="Toplam gider" value={tl(costTotal)} />
            <Stat label="Ödenen" value={tl(costPaid)} />
            <Stat label="Kalan bütçe" value={tl(ev.budgetTl - costTotal)} warn={ev.budgetTl - costTotal < 0} />
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {costs.map((c) => (
              <li key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, borderRadius: 12, border: "1px solid var(--line)", flexWrap: "wrap" }}>
                <input type="checkbox" checked={c.paid} disabled={busy} aria-label={`${c.name} ödendi`} onChange={(e) => call(`${base}/org/costs/${c.id}`, "PATCH", { paid: e.currentTarget.checked })} />
                <span style={{ flex: 1, minWidth: 140 }}>{c.name} <span style={{ color: "var(--muted)", fontSize: ".82rem" }}>· {CAT[c.category] ?? c.category}</span></span>
                <strong>{tl(c.amountTl)}</strong>
                <button type="button" disabled={busy} aria-label={`${c.name} sil`} onClick={() => call(`${base}/org/costs/${c.id}`, "DELETE", {})} style={{ ...btn, padding: "6px 10px", color: "#b42318" }}>✕</button>
              </li>
            ))}
          </ul>
          <form key={`cost-${costs.length}`} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); call(`${base}/org/events/${ev.id}/costs`, "POST", { name: f.get("name"), category: f.get("category"), amountTl: f.get("amountTl") }).then((ok) => ok && e.currentTarget.reset()); }}
            style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", alignItems: "end" }}>
            <input name="name" required minLength={2} maxLength={120} placeholder="Gider kalemi" style={input} />
            <select name="category" defaultValue="diger" style={input}>{COST_CATEGORIES.map((c) => <option key={c} value={c}>{CAT[c]}</option>)}</select>
            <input name="amountTl" type="number" min={0} step="any" required placeholder="Tutar (TL)" style={input} />
            <button type="submit" disabled={busy} style={primary}>Gider ekle</button>
          </form>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 2, padding: 12, borderRadius: 14, background: "var(--subtle)" }}>
      <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>{label}</span>
      <strong style={{ color: warn ? "#b42318" : "var(--text)" }}>{value}</strong>
    </div>
  );
}
