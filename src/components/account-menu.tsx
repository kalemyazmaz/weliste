"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface AccountLink { label: string; href: string }

// Sağ üstteki hesap menüsü. Bağlantılar sayfaya göre verilir; çıkış her zaman en altta.
export function AccountMenu({ email, links }: { email: string; links: AccountLink[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const initial = (email.trim()[0] ?? "?").toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    router.replace("/giris");
    router.refresh();
  }

  const item = { display: "block", padding: "10px 12px", borderRadius: 10, color: "var(--text)", textDecoration: "none", fontWeight: 600 } as const;

  return (
    <div ref={wrap} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label="Hesap menüsü"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ width: 36, height: 36, borderRadius: 999, border: "2px solid var(--accent)", background: "var(--plum-700)", color: "#fff", fontWeight: 800, cursor: "pointer" }}
      >
        {initial}
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: 44, zIndex: 50, minWidth: 240, padding: 8, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)", boxShadow: "0 12px 32px rgba(11,31,51,.14)", display: "grid", gap: 2 }}>
          <div style={{ padding: "10px 12px 12px", borderBottom: "1px solid var(--line)", marginBottom: 4 }}>
            <span style={{ display: "block", color: "var(--muted)", fontSize: ".78rem" }}>Giriş yapılan hesap</span>
            <strong style={{ display: "block", overflowWrap: "anywhere", fontSize: ".92rem" }}>{email}</strong>
          </div>
          {links.map((l) => (
            <Link key={l.href} role="menuitem" href={l.href} onClick={() => setOpen(false)} style={item}>{l.label}</Link>
          ))}
          <button role="menuitem" type="button" onClick={logout} disabled={busy} style={{ ...item, border: 0, background: "none", textAlign: "left", font: "inherit", cursor: "pointer", color: "#b42318", borderTop: "1px solid var(--line)", marginTop: 4, borderRadius: 0, paddingTop: 12 }}>
            {busy ? "Çıkılıyor…" : "Çıkış yap"}
          </button>
        </div>
      )}
    </div>
  );
}
