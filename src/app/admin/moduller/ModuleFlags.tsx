"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminCall, card } from "../ui";

interface M { key: string; label: string; desc: string; sectors: string[]; enabled: boolean }

export function ModuleFlags({ items }: { items: M[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle(m: M) {
    setBusy(m.key); setMsg(null);
    const r = await adminCall(`/api/admin/modules/${m.key}`, "PUT", { enabled: !m.enabled });
    setBusy(null);
    if (!r.ok) { setMsg(r.text); return; }
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {msg && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{msg}</p>}
      {items.map((m) => (
        <article key={m.key} style={{ ...card, gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <strong>{m.label}</strong>
            <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{m.desc}</span>
            <span style={{ color: "var(--muted)", fontSize: ".82rem" }}>Sektörler: {m.sectors.join(", ")}</span>
          </div>
          <button type="button" role="switch" aria-checked={m.enabled} aria-label={`${m.label} ${m.enabled ? "kapat" : "aç"}`} disabled={busy === m.key} onClick={() => toggle(m)}
            style={{ width: 52, height: 30, borderRadius: 999, border: 0, padding: 3, cursor: "pointer", background: m.enabled ? "var(--plum-700)" : "var(--line)", display: "flex", justifyContent: m.enabled ? "flex-end" : "flex-start" }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#fff" }} />
          </button>
        </article>
      ))}
    </div>
  );
}
