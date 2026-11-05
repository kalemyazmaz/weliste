"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Member { userId: string; email: string; role: string }

const input = { padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)", font: "inherit" } as const;

// Ekip listesi ve davet. Yalnızca sahip davet edebilir ya da üye çıkarabilir.
export function MembersManager({ tenantId, members, currentUserId, isOwner }: { tenantId: string; members: Member[]; currentUserId: string; isOwner: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    setBusy(true); setError(null); setNotice(null);
    const res = await fetch(`/api/tenants/${tenantId}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (res.ok) { form.reset(); setNotice("Davet gönderildi. Kişi parolasını e-postadaki bağlantıdan belirleyecek."); router.refresh(); return; }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(body.error === "already_member" ? "Bu kişi zaten ekipte." : "Davet gönderilemedi. E-postayı kontrol edin.");
  }

  async function remove(userId: string) {
    if (!window.confirm("Bu üye işletmeden çıkarılsın mı?")) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/tenants/${tenantId}/members/${userId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    if (res.ok) router.refresh(); else setError("Üye çıkarılamadı.");
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
        {members.map((m) => (
          <li key={m.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}>
            <span>{m.email} <span style={{ color: "var(--muted)", fontSize: ".85rem" }}>· {m.role === "owner" ? "Sahip" : "Üye"}{m.userId === currentUserId ? " (siz)" : ""}</span></span>
            {isOwner && m.role !== "owner" && (
              <button type="button" disabled={busy} onClick={() => remove(m.userId)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", cursor: "pointer" }}>Çıkar</button>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form onSubmit={invite} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input name="email" type="email" required placeholder="ekip@ornek.com" style={{ ...input, flex: "1 1 240px" }} />
          <button type="submit" disabled={busy} style={{ padding: "10px 16px", borderRadius: 10, border: 0, background: "var(--plum-700, var(--plum-700))", color: "#fff", cursor: "pointer" }}>Davet et</button>
        </form>
      )}
      {notice && <p role="status" style={{ margin: 0, color: "#067647" }}>{notice}</p>}
      {error && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{error}</p>}
    </div>
  );
}
