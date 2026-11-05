"use client";

import { useState } from "react";

interface Props {
  tenantId: string;
  token: string;
  data: {
    title: string; clientName: string; photoLimit: number; expiresAt: string;
    expired: boolean; closed: boolean; submitted: boolean;
    photos: Array<{ id: string; data: string; selected: boolean }>;
  };
}

// Müşteri seçim ekranı. Limit kadar fotoğraf seçilir ve tek seferde gönderilir.
export function DeliveryClient({ tenantId, token, data }: Props) {
  const locked = data.expired || data.closed || data.submitted;
  const [selected, setSelected] = useState<string[]>(data.photos.filter((p) => p.selected).map((p) => p.id));
  const [done, setDone] = useState(data.submitted);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(id: string) {
    if (locked) return;
    setErr(null);
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= data.photoLimit) { setErr(`En fazla ${data.photoLimit} fotoğraf seçebilirsiniz.`); return cur; }
      return [...cur, id];
    });
  }

  async function submit() {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/public/tenants/${tenantId}/delivery/${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoIds: selected }),
    });
    setBusy(false);
    if (res.ok) { setDone(true); return; }
    if (res.status === 410) setErr("Bu linkin süresi dolmuş.");
    else if (res.status === 409) setErr("Seçiminiz zaten gönderilmiş.");
    else setErr("Seçim gönderilemedi. Lütfen seçiminizi kontrol edin.");
  }

  const banner = data.expired ? "Bu linkin süresi doldu." : data.closed ? "Bu seçim artık kapalı." : done ? "Seçiminiz alındı. Teşekkür ederiz." : null;

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 16px 120px", display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: "clamp(1.4rem, 3vw, 1.9rem)" }}>{data.title}</h1>
        {data.clientName && <span style={{ color: "var(--muted)" }}>{data.clientName}</span>}
        <span style={{ color: "var(--muted)", fontSize: ".92rem" }}>Beğendiğiniz en fazla {data.photoLimit} fotoğrafı seçin. Fotoğrafa dokunarak seçebilirsiniz.</span>
      </div>

      {banner && <p role="status" style={{ margin: 0, padding: 14, borderRadius: 14, background: "var(--subtle)", border: "1px solid var(--line)" }}>{banner}</p>}
      {err && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{err}</p>}

      {data.photos.length === 0 ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>Henüz fotoğraf eklenmemiş.</p>
      ) : (
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
          {data.photos.map((p, i) => {
            const on = selected.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => toggle(p.id)} disabled={locked} aria-pressed={on} aria-label={`Fotoğraf ${i + 1}${on ? ", seçili" : ""}`}
                style={{ position: "relative", padding: 0, aspectRatio: "1 / 1", borderRadius: 14, overflow: "hidden", border: on ? "4px solid var(--accent)" : "1px solid var(--line)", cursor: locked ? "default" : "pointer", background: "var(--subtle)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.data} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: on ? 1 : 0.92 }} />
                <span style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 800, background: on ? "var(--accent)" : "rgba(0,0,0,.45)", color: on ? "var(--text)" : "#fff" }}>{on ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>
      )}

      {!locked && !done && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", background: "var(--surface)", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <strong>{selected.length} / {data.photoLimit} seçildi</strong>
          <button type="button" onClick={submit} disabled={busy || selected.length === 0} style={{ padding: "12px 18px", borderRadius: 12, border: 0, background: "var(--plum-700)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: selected.length === 0 ? 0.5 : 1 }}>
            {busy ? "Gönderiliyor…" : "Seçimi gönder"}
          </button>
        </div>
      )}
    </div>
  );
}
