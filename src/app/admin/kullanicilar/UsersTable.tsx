"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminCall, btn, card } from "../ui";

interface U { id: string; email: string; createdAt: string; isAdmin: boolean; disabled: boolean; tenantCount: number }

export function UsersTable({ users }: { users: U[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function flag(u: U, body: { isAdmin?: boolean; disabled?: boolean }) {
    setBusy(u.id); setMsg(null);
    const r = await adminCall(`/api/admin/users/${u.id}`, "PATCH", body);
    setBusy(null);
    if (!r.ok) { setMsg(r.text); return; }
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {msg && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{msg}</p>}
      {users.map((u) => (
        <article key={u.id} style={{ ...card, gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <strong style={{ overflowWrap: "anywhere" }}>{u.email}</strong>
            <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>
              {new Date(u.createdAt).toLocaleDateString("tr-TR")} · {u.tenantCount} işletme
              {u.isAdmin && " · yönetici"}{u.disabled && " · devre dışı"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={busy === u.id} onClick={() => flag(u, { isAdmin: !u.isAdmin })} style={btn}>{u.isAdmin ? "Yöneticiliği kaldır" : "Yönetici yap"}</button>
            <button type="button" disabled={busy === u.id} onClick={() => { if (u.disabled || window.confirm(`${u.email} devre dışı bırakılsın mı?`)) flag(u, { disabled: !u.disabled }); }} style={{ ...btn, color: u.disabled ? "var(--text)" : "#b42318" }}>{u.disabled ? "Etkinleştir" : "Devre dışı bırak"}</button>
          </div>
        </article>
      ))}
    </div>
  );
}
