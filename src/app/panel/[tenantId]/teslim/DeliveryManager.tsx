"use client";

import { useState } from "react";
import { resizeToDataUrl } from "@/components/image-field";
import type { DeliverySummary } from "@/lib/delivery";

interface DeliveryPhoto { id: string; data: string; selected: boolean }

const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)", width: "100%" } as const;
const card = { display: "grid", gap: 12, padding: 18, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)" } as const;
const btn = { padding: "9px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 700, font: "inherit" } as const;
const primary = { ...btn, border: 0, background: "var(--plum-700)", color: "#fff" } as const;

function status(s: DeliverySummary): string {
  if (s.closed) return "Kapalı";
  if (new Date(s.expiresAt).getTime() < Date.now()) return "Süresi doldu";
  if (s.submittedAt) return "Seçim tamamlandı";
  return "Açık";
}

// Fotoğraf teslim yönetimi: oturum açma, fotoğraf yükleme, müşteri linki ve seçim sonuçları.
export function DeliveryManager({ tenantId, initialSessions }: { tenantId: string; initialSessions: DeliverySummary[] }) {
  const [sessions, setSessions] = useState<DeliverySummary[]>(initialSessions);
  const [openId, setOpenId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<DeliveryPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [limit, setLimit] = useState("10");
  const current = sessions.find((s) => s.id === openId) ?? null;
  const base = `/api/tenants/${tenantId}/delivery`;

  async function reload() {
    const res = await fetch(base, { cache: "no-store" });
    if (res.ok) setSessions(((await res.json()) as { items: DeliverySummary[] }).items);
  }

  async function open(id: string) {
    setOpenId(id); setMsg(null);
    const res = await fetch(`${base}/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { session: DeliverySummary; photos: DeliveryPhoto[] };
    setPhotos(data.photos);
    setLimit(String(data.session.photoLimit));
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setMsg(null);
    const res = await fetch(base, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: f.get("title"), clientName: f.get("clientName"), photoLimit: Number(f.get("photoLimit")), days: Number(f.get("days")) }),
    });
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: "Oturum açılamadı. Başlığı ve sayıları kontrol edin." }); return; }
    const created = (await res.json()) as { id: string };
    form.reset();
    await reload();
    await open(created.id);
    setMsg({ ok: true, text: "Teslim oturumu açıldı. Linki müşterinize gönderin." });
  }

  async function patch(body: Record<string, unknown>, okText: string) {
    if (!current) return;
    setBusy(true); setMsg(null);
    const res = await fetch(`${base}/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: "Güncellenemedi." }); return; }
    await reload(); await open(current.id);
    setMsg({ ok: true, text: okText });
  }

  async function remove() {
    if (!current || !window.confirm("Bu teslim oturumu ve fotoğrafları silinsin mi?")) return;
    setBusy(true);
    await fetch(`${base}/${current.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    setOpenId(null); setPhotos([]);
    await reload();
  }

  async function upload(files: FileList | null) {
    if (!current || !files) return;
    setBusy(true); setMsg(null);
    let failed = 0;
    for (const file of Array.from(files)) {
      const data = await resizeToDataUrl(file, 1400);
      if (!data) { failed++; continue; }
      const res = await fetch(`${base}/${current.id}/photos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: data }) });
      if (!res.ok) failed++;
    }
    setBusy(false);
    await open(current.id); await reload();
    setMsg(failed ? { ok: false, text: `${failed} fotoğraf eklenemedi (boyut veya oturum sınırı).` } : { ok: true, text: "Fotoğraflar eklendi." });
  }

  async function removePhoto(pid: string) {
    if (!current) return;
    setBusy(true);
    await fetch(`${base}/${current.id}/photos/${pid}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    await open(current.id); await reload();
  }

  function linkFor(s: DeliverySummary) {
    return `${typeof window !== "undefined" ? window.location.origin : ""}/teslim/${tenantId}/${s.token}`;
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {msg && <p role="status" style={{ margin: 0, color: msg.ok ? "#067647" : "#b42318" }}>{msg.text}</p>}

      <form onSubmit={create} style={{ ...card, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end" }}>
        <strong style={{ gridColumn: "1 / -1" }}>Yeni teslim oturumu</strong>
        <label style={{ display: "grid", gap: 4, fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>Başlık<input name="title" required minLength={2} maxLength={120} placeholder="Ayşe & Mehmet düğün çekimi" style={input} /></label>
        <label style={{ display: "grid", gap: 4, fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>Müşteri adı<input name="clientName" maxLength={120} placeholder="İsteğe bağlı" style={input} /></label>
        <label style={{ display: "grid", gap: 4, fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>Seçim limiti<input name="photoLimit" type="number" min={1} max={200} defaultValue={10} style={input} /></label>
        <label style={{ display: "grid", gap: 4, fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>Geçerlilik (gün)<input name="days" type="number" min={1} max={365} defaultValue={30} style={input} /></label>
        <button type="submit" disabled={busy} style={primary}>Oturum aç</button>
      </form>

      <div style={{ display: "grid", gap: 10 }}>
        {sessions.length === 0 && <p style={{ margin: 0, color: "var(--muted)" }}>Henüz teslim oturumu yok.</p>}
        {sessions.map((s) => (
          <button key={s.id} type="button" onClick={() => open(s.id)} style={{ ...card, textAlign: "left", cursor: "pointer", borderColor: openId === s.id ? "var(--accent)" : "var(--line)" }}>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong>{s.title}</strong>
              <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>{status(s)}</span>
            </span>
            <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>{s.clientName || "Müşteri adı yok"} · {s.photoCount} fotoğraf · {s.selectedCount}/{s.photoLimit} seçim</span>
          </button>
        ))}
      </div>

      {current && (
        <section style={{ ...card, gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "grid", gap: 2 }}>
              <strong style={{ fontSize: "1.1rem" }}>{current.title}</strong>
              <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>{status(current)} · son geçerlilik {new Date(current.expiresAt).toLocaleDateString("tr-TR")}</span>
            </div>
            <button type="button" onClick={() => navigator.clipboard?.writeText(linkFor(current))} style={btn}>Müşteri linkini kopyala</button>
          </div>
          <code style={{ fontSize: ".82rem", overflowWrap: "anywhere", color: "var(--muted)" }}>{linkFor(current)}</code>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: ".9rem" }}>Seçim limiti
              <input type="number" min={1} max={200} value={limit} onChange={(e) => setLimit(e.target.value)} style={{ ...input, width: 90 }} />
            </label>
            <button type="button" disabled={busy} onClick={() => patch({ photoLimit: Number(limit) }, "Seçim limiti güncellendi.")} style={btn}>Limiti kaydet</button>
            <button type="button" disabled={busy} onClick={() => patch({ days: 30 }, "Geçerlilik 30 gün uzatıldı.")} style={btn}>30 gün uzat</button>
            <button type="button" disabled={busy} onClick={() => patch({ closed: !current.closed }, current.closed ? "Oturum yeniden açıldı." : "Oturum kapatıldı.")} style={btn}>{current.closed ? "Yeniden aç" : "Kapat"}</button>
            <button type="button" disabled={busy} onClick={remove} style={{ ...btn, color: "#b42318" }}>Oturumu sil</button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ ...primary, display: "inline-block", cursor: busy || current.closed ? "default" : "pointer", opacity: busy || current.closed ? 0.5 : 1 }}>
              Fotoğraf ekle
              <input type="file" accept="image/*" multiple disabled={busy || current.closed} onChange={(e) => { upload(e.target.files); e.currentTarget.value = ""; }} style={{ display: "none" }} />
            </label>
            <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{photos.length} fotoğraf · müşteri seçimi: {photos.filter((p) => p.selected).length}/{current.photoLimit}</span>
          </div>

          {photos.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>Henüz fotoğraf yok. Müşterinin seçebilmesi için fotoğraf ekleyin.</p>
          ) : (
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
              {photos.map((p) => (
                <div key={p.id} style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden", border: p.selected ? "3px solid var(--accent)" : "1px solid var(--line)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.data} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  {p.selected && <span style={{ position: "absolute", left: 6, bottom: 6, padding: "2px 8px", borderRadius: 999, background: "var(--accent)", color: "var(--text)", fontSize: ".72rem", fontWeight: 800 }}>Seçildi</span>}
                  <button type="button" aria-label="Fotoğrafı sil" disabled={busy || current.closed} onClick={() => removePhoto(p.id)} style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 999, border: 0, background: "rgba(0,0,0,.6)", color: "#fff", cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
