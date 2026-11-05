"use client";

import { useState } from "react";

// Müşteri yorumu formu. Yorum işletme onayından sonra yayınlanır.
export function ReviewForm({ tenantId }: { tenantId: string }) {
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)", width: "100%" } as const;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/public/tenants/${tenantId}/reviews`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: f.get("name"), rating, body: f.get("body") }),
    });
    setBusy(false);
    if (res.ok) { form.reset(); setMsg({ ok: true, text: "Yorumunuz alındı. İşletme onayladıktan sonra yayınlanır." }); }
    else setMsg({ ok: false, text: "Yorum gönderilemedi. Lütfen bilgileri kontrol edin." });
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10, padding: 16, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)" }}>
      <strong>Deneyiminizi paylaşın</strong>
      <div role="radiogroup" aria-label="Puan" style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} yıldız`} onClick={() => setRating(n)} style={{ border: 0, background: "none", cursor: "pointer", fontSize: 26, color: n <= rating ? "#f59e0b" : "var(--line)" }}>★</button>
        ))}
      </div>
      <input name="name" required minLength={2} maxLength={60} placeholder="Adınız" style={input} />
      <textarea name="body" rows={3} maxLength={1000} placeholder="Yorumunuz (isteğe bağlı)" style={{ ...input, resize: "vertical" }} />
      <button type="submit" disabled={busy} style={{ padding: "11px 16px", borderRadius: 12, border: 0, background: "var(--plum-700)", color: "#fff", cursor: "pointer", fontWeight: 700, justifySelf: "start" }}>{busy ? "Gönderiliyor…" : "Yorumu gönder"}</button>
      {msg && <p role="status" style={{ margin: 0, color: msg.ok ? "#067647" : "#b42318" }}>{msg.text}</p>}
    </form>
  );
}
