"use client";

import { useState } from "react";
import { Field } from "@/components/auth-ui";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    if (!res.ok) {
      setBusy(false);
      setError(res.status === 429 ? "Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin." : "E-posta veya şifre hatalı.");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    // Only same-site relative paths are accepted as redirect targets.
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    if (safeNext) return window.location.assign(safeNext);
    // No explicit target: open the first tenant's panel.
    const me = (await fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null))) as { tenants?: Array<{ id: string }>; admin?: boolean } | null;
    const first = me?.tenants?.[0];
    if (first) window.location.assign(`/panel/${first.id}`);
    else if (me?.admin) window.location.assign("/yonetim/talepler");
    else {
      setBusy(false);
      setError("Bu hesaba bağlı bir işletme yok. Yeni işletme için hesap oluşturun.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="form card">
      <Field label="E-posta">
        <input className="input" name="email" type="email" required autoComplete="username" />
      </Field>
      <Field label="Şifre">
        <input className="input" name="password" type="password" required autoComplete="current-password" />
      </Field>
      {error && <p className="form__error" role="alert">{error}</p>}
      <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
        {busy ? "Giriliyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
