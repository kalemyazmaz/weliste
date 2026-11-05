"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Oturumu kapatır ve giriş sayfasına döner.
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    router.replace("/giris");
    router.refresh();
  }
  return (
    <button type="button" className="btn btn--ghost btn--sm" onClick={logout} disabled={busy}>
      {busy ? "Çıkılıyor…" : "Çıkış yap"}
    </button>
  );
}
