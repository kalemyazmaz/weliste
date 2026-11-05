"use client";

import { useState } from "react";
import type { VenueShareLink } from "@/lib/venue";

const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)", width: "100%" } as const;
const btn = { padding: "8px 12px", borderRadius: 12, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 700, font: "inherit" } as const;

// Paylaşım linki yönetimi. Link yalnızca müsaitliği gösterir; kişi, telefon ve fiyat içermez.
export function ShareManager({ tenantId, initialLinks }: { tenantId: string; initialLinks: VenueShareLink[] }) {
  const [links, setLinks] = useState(initialLinks);
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const url = (t: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/musaitlik/${tenantId}/${t}`;

  async function reload() {
    const r = await fetch(`/api/tenants/${tenantId}/venue/share`, { cache: "no-store" });
    if (r.ok) setLinks(((await r.json()) as { items: VenueShareLink[] }).items);
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/tenants/${tenantId}/venue/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: f.get("label"), days: Number(f.get("days")) }) });
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: "Link oluşturulamadı." }); return; }
    const data = (await res.json()) as { token: string };
    setCreated(url(data.token));
    e.currentTarget.reset();
    await reload();
  }
  async function revoke(id: string) {
    if (!window.confirm("Bu link artık çalışmayacak. Devam edilsin mi?")) return;
    setBusy(true);
    await fetch(`/api/tenants/${tenantId}/venue/share/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    await reload();
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <form onSubmit={create} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", alignItems: "end", padding: 18, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)" }}>
        <label style={{ display: "grid", gap: 4, fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>Etiket<input name="label" maxLength={120} placeholder="Ayşe & Mehmet" style={input} /></label>
        <label style={{ display: "grid", gap: 4, fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>Geçerlilik (gün)<input name="days" type="number" min={1} max={365} defaultValue={60} style={input} /></label>
        <button type="submit" disabled={busy} style={{ ...btn, background: "var(--plum-700)", color: "#fff", border: 0 }}>Link oluştur</button>
      </form>
      {created && (
        <div role="status" style={{ display: "grid", gap: 8, padding: 14, borderRadius: 14, background: "#D8F5F0", color: "var(--text)" }}>
          <strong>Yeni link hazır</strong>
          <code style={{ overflowWrap: "anywhere", fontSize: ".85rem" }}>{created}</code>
          <button type="button" onClick={() => navigator.clipboard?.writeText(created)} style={{ ...btn, justifySelf: "start" }}>Kopyala</button>
        </div>
      )}
      {msg && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{msg.text}</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {links.length === 0 && <p style={{ margin: 0, color: "var(--muted)" }}>Henüz paylaşım linki yok.</p>}
        {links.map((l) => {
          const status = l.revoked ? "İptal edildi" : l.expired ? "Süresi doldu" : "Aktif";
          return (
            <article key={l.id} style={{ display: "grid", gap: 6, padding: 16, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong>{l.label || "Etiketsiz link"}</strong>
                <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{status} · son {new Date(l.expiresAt).toLocaleDateString("tr-TR")}</span>
              </div>
              {!l.revoked && !l.expired && <code style={{ overflowWrap: "anywhere", fontSize: ".82rem", color: "var(--muted)" }}>{url(l.token)}</code>}
              {!l.revoked && !l.expired && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(url(l.token))} style={btn}>Kopyala</button>
                  <button type="button" disabled={busy} onClick={() => revoke(l.id)} style={{ ...btn, color: "#b42318" }}>İptal et</button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
