"use client";

import { useState } from "react";
import { Field } from "./auth-ui";

// Ortak istek yardımcısı; sunucu hata kodunu okunur Türkçe mesaja çevirir.
async function post(url: string, body: unknown) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function formData(e: React.FormEvent<HTMLFormElement>) {
  return Object.fromEntries(new FormData(e.currentTarget).entries());
}

const ERRORS: Record<string, string> = {
  email_taken: "Bu e-posta ile zaten bir hesap var.",
  validation: "Bilgileri kontrol edin; eksik ya da hatalı alan var.",
  too_many_attempts: "Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.",
  invalid_token: "Bağlantı geçersiz ya da süresi dolmuş. Yeni bir bağlantı isteyin.",
  invalid_credentials: "E-posta veya şifre hatalı.",
};

async function errorText(res: Response) {
  const body = (await res.json().catch(() => ({}))) as { error?: string; fields?: string[] };
  const base = ERRORS[body.error ?? ""] ?? "Bir sorun oluştu. Lütfen tekrar deneyin.";
  return body.fields?.length ? `${base} (${body.fields.join(", ")})` : base;
}

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = formData(e); // olay, await'ten sonra kullanılamaz; veri önce alınır
    const res = await post("/api/auth/signup", data);
    if (!res.ok) {
      setBusy(false);
      return setError(await errorText(res));
    }
    const { tenantId } = (await res.json()) as { tenantId: string };
    window.location.assign(`/panel/${tenantId}`);
  }
  return (
    <form onSubmit={onSubmit} className="form card">
      <Field label="İşletme adı"><input className="input" name="tenantName" required minLength={2} /></Field>
      <Field label="Şehir"><input className="input" name="city" required minLength={2} /></Field>
      <Field label="Sektör">
        <select className="select" name="sector" required defaultValue="dugun-salonu">
          <option value="dugun-salonu">Düğün salonu</option>
          <option value="fotografci">Fotoğrafçı</option>
          <option value="organizasyon">Organizasyon</option>
          <option value="sac-makyaj">Saç ve makyaj</option>
        </select>
      </Field>
      <Field label="E-posta"><input className="input" name="email" type="email" required autoComplete="email" /></Field>
      <Field label="Şifre" hint="En az 10 karakter">
        <input className="input" name="password" type="password" required minLength={10} autoComplete="new-password" />
      </Field>
      {error && <p className="form__error" role="alert">{error}</p>}
      <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
        {busy ? "Oluşturuluyor…" : "Hesap oluştur"}
      </button>
    </form>
  );
}

export function ResetRequestForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const res = await post("/api/auth/password-reset/request", formData(e));
    if (!res.ok) return setError(await errorText(res));
    setSent(true); // aynı mesaj, hesap var ya da yok
  }
  if (sent) return <div className="notice notice--ok">E-posta adresiniz kayıtlıysa sıfırlama bağlantısı gönderildi.</div>;
  return (
    <form onSubmit={onSubmit} className="form card">
      <Field label="E-posta"><input className="input" name="email" type="email" required autoComplete="email" /></Field>
      {error && <p className="form__error" role="alert">{error}</p>}
      <button className="btn btn--primary btn--block" type="submit">Bağlantı gönder</button>
    </form>
  );
}

export function ResetConfirmForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const res = await post("/api/auth/password-reset/confirm", { token, password: formData(e).password });
    if (!res.ok) return setError(await errorText(res));
    setDone(true);
  }
  if (done) {
    return (
      <div className="notice notice--ok">
        Parolanız güncellendi. <a href="/giris"><b>Giriş yapın</b></a>.
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="form card">
      <Field label="Yeni şifre" hint="En az 10 karakter">
        <input className="input" name="password" type="password" required minLength={10} autoComplete="new-password" />
      </Field>
      {error && <p className="form__error" role="alert">{error}</p>}
      <button className="btn btn--primary btn--block" type="submit">Şifreyi güncelle</button>
    </form>
  );
}
