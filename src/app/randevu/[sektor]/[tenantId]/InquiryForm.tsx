"use client";

import { useState } from "react";

const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)", width: "100%" } as const;

// Düğün salonu teklif formu: müşteri tarih, misafir sayısı ve notunu bırakır; işletme dönüş yapar.
export function InquiryForm({ tenantId }: { tenantId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/public/tenants/${tenantId}/inquiries`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: f.get("name"), phone: f.get("phone"), eventDate: f.get("eventDate") || "", guestCount: f.get("guestCount") || "", message: f.get("message") }),
    });
    setBusy(false);
    if (res.ok) { form.reset(); setMsg({ ok: true, text: "Teklif talebiniz alındı. İşletme sizinle iletişime geçecek." }); }
    else setMsg({ ok: false, text: "Talep gönderilemedi. Lütfen bilgileri kontrol edin." });
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10, padding: 18, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)" }}>
      <strong>Teklif iste</strong>
      <input name="name" required minLength={2} maxLength={120} placeholder="Adınız soyadınız" style={input} />
      <input name="phone" required placeholder="Telefon" style={input} />
      <input name="eventDate" type="date" style={input} aria-label="Düğün tarihi" />
      <input name="guestCount" type="number" min={1} max={5000} placeholder="Tahmini misafir sayısı" style={input} />
      <textarea name="message" rows={3} maxLength={1000} placeholder="Notunuz (salon, paket, özel istekler)" style={{ ...input, resize: "vertical" }} />
      <button type="submit" disabled={busy} style={{ padding: "12px 16px", borderRadius: 12, border: 0, background: "var(--plum-700)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{busy ? "Gönderiliyor…" : "Teklif iste"}</button>
      {msg && <p role="status" style={{ margin: 0, color: msg.ok ? "#067647" : "#b42318" }}>{msg.text}</p>}
    </form>
  );
}
