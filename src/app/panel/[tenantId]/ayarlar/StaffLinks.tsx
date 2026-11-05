"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  tenantId: string;
  staff: Array<{ id: string; name: string; userId: string | null }>;
  members: Array<{ userId: string; email: string; role: string }>;
}

// Personel kaydını ekip hesabına bağlar. Bağlı üye yalnızca kendi randevularını görür.
export function StaffLinks({ tenantId, staff, members }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link(staffId: string, userId: string) {
    setBusy(true); setError(null);
    const res = await fetch(`/api/tenants/${tenantId}/staff/${staffId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId || null }),
    });
    setBusy(false);
    if (res.ok) { router.refresh(); return; }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(body.error === "user_already_linked" ? "Bu hesap başka bir personele bağlı." : "Bağlantı kaydedilemedi.");
  }

  if (staff.length === 0) return <p style={{ margin: 0, color: "var(--muted)" }}>Önce personel ekleyin.</p>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {staff.map((s) => (
        <label key={s.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <span>{s.name}</span>
          <select disabled={busy} defaultValue={s.userId ?? ""} onChange={(e) => link(s.id, e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)", minWidth: 220 }}>
            <option value="">Bağlı hesap yok</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.email}{m.role === "owner" ? " (sahip)" : ""}</option>)}
          </select>
        </label>
      ))}
      {error && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{error}</p>}
    </div>
  );
}
