"use client";

import { useState } from "react";

const input = { padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)", font: "inherit", width: "100%" } as const;

// Parola değişikliği. Başarıdan sonra diğer oturumlar kapanır.
export function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setMsg(null);
    const res = await fetch("/api/auth/change-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: f.get("currentPassword"), newPassword: f.get("newPassword") }),
    });
    setBusy(false);
    if (res.ok) { form.reset(); setMsg({ ok: true, text: "Parolanız değiştirildi. Diğer oturumlar kapatıldı." }); return; }
    const body = (await res.json().catch(() => ({}))) as { fields?: string[] };
    setMsg({ ok: false, text: body.fields?.includes("newPassword") ? "Yeni parola en az 10 karakter olmalı." : "Mevcut parola hatalı." });
  }

  return (
    <form id="sifre" onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 420, scrollMarginTop: 90 }}>
      <input name="currentPassword" type="password" required autoComplete="current-password" placeholder="Mevcut parola" style={input} />
      <input name="newPassword" type="password" required minLength={10} autoComplete="new-password" placeholder="Yeni parola (en az 10 karakter)" style={input} />
      <button type="submit" disabled={busy} style={{ padding: "10px 16px", borderRadius: 10, border: 0, background: "var(--plum-700, var(--plum-700))", color: "#fff", cursor: "pointer", justifySelf: "start" }}>
        {busy ? "Kaydediliyor…" : "Parolayı değiştir"}
      </button>
      {msg && <p role="status" style={{ margin: 0, color: msg.ok ? "#067647" : "#b42318" }}>{msg.text}</p>}
    </form>
  );
}
