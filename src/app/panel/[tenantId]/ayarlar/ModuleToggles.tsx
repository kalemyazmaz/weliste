"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { modulesForSector, type ModuleKey } from "@/lib/module-catalog";

// İsteğe bağlı özellik anahtarları. Kapatılan özellik gizlenir; veriler silinmez.
export function ModuleToggles({ tenantId, modules, sector }: { tenantId: string; modules: Record<ModuleKey, boolean>; sector: string | null }) {
  const router = useRouter();
  const [state, setState] = useState(modules);
  const [busy, setBusy] = useState<ModuleKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: ModuleKey) {
    const next = !state[key];
    setBusy(key); setError(null);
    const res = await fetch(`/api/tenants/${tenantId}/modules`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: next }),
    });
    setBusy(null);
    if (res.ok) { setState((s) => ({ ...s, [key]: next })); router.refresh(); } else setError("Özellik güncellenemedi.");
  }

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
      {modulesForSector(sector).map((m) => {
        const on = state[m.key];
        return (
          <div key={m.key} style={{ display: "grid", gap: 8, padding: 16, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <strong>{m.label}</strong>
              <button type="button" role="switch" aria-checked={on} aria-label={`${m.label} ${on ? "kapat" : "aç"}`} disabled={busy === m.key} onClick={() => toggle(m.key)}
                style={{ width: 46, height: 26, borderRadius: 999, border: 0, padding: 3, cursor: "pointer", background: on ? "var(--accent)" : "var(--line)", display: "flex", justifyContent: on ? "flex-end" : "flex-start", flexShrink: 0 }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--surface)" }} />
              </button>
            </div>
            <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>{m.desc}</span>
          </div>
        );
      })}
      {error && <p role="alert" style={{ margin: 0, color: "#b42318", gridColumn: "1 / -1" }}>{error}</p>}
    </div>
  );
}
