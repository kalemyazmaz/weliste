"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface StaffItem { id: string; name: string; role: string; userId: string | null; active: boolean }
interface Member { userId: string; email: string; role: string }

const input = { padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)", font: "inherit", width: "100%", background: "var(--surface)", color: "var(--text)" } as const;
const label = { display: "grid", gap: 4, fontSize: ".82rem", color: "var(--muted)" } as const;
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

async function api(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: string[] };
  if (data.error === "staff_has_appointments") return "Bu personelin gelecek randevuları var. Önce bu randevuları iptal edin.";
  if (data.error === "user_already_linked") return "Bu hesap başka bir personele bağlı.";
  if (res.status === 403) return "Bu işlem için yetkiniz yok.";
  return data.fields?.length ? `Hatalı alan: ${data.fields.join(", ")}` : "İşlem tamamlanamadı.";
}

// Personel kartları: aktiflik, unvan, hesap bağlantısı. Yalnızca sahip düzenleyebilir.
export function StaffCards({ tenantId, staff, members, isOwner }: { tenantId: string; staff: StaffItem[]; members: Member[]; isOwner: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const base = `/api/tenants/${tenantId}/staff`;

  async function run(p: Promise<string | null>) {
    setBusy(true); setError(null);
    const err = await p;
    setBusy(false);
    if (err) setError(err); else router.refresh();
    return !err;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{error}</p>}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {staff.map((s) => {
          const linked = members.find((m) => m.userId === s.userId);
          return (
            <article key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, padding: 18, display: "grid", gap: 14, opacity: s.active ? 1 : 0.6 }}>
              <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div aria-hidden="true" style={{ width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, color: "#fff", background: "linear-gradient(135deg, var(--plum-700), var(--accent))", flexShrink: 0 }}>
                  {initials(s.name)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</strong>
                  <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>{s.role || "Personel"}</span>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={s.active}
                    aria-label={`${s.name} ${s.active ? "pasifleştir" : "aktifleştir"}`}
                    disabled={busy}
                    onClick={() => run(api(`${base}/${s.id}`, "PATCH", { active: !s.active }))}
                    style={{ width: 46, height: 26, borderRadius: 999, border: 0, padding: 3, cursor: "pointer", background: s.active ? "var(--accent)" : "var(--line)", display: "flex", justifyContent: s.active ? "flex-end" : "flex-start" }}
                  >
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--surface)" }} />
                  </button>
                )}
              </header>

              {editing === s.id ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const ok = await run(api(`${base}/${s.id}`, "PATCH", { name: f.get("name"), role: f.get("role"), userId: f.get("userId") || null }));
                    if (ok) setEditing(null);
                  }}
                  style={{ display: "grid", gap: 8 }}
                >
                  <label style={label}>Ad soyad<input name="name" required minLength={2} defaultValue={s.name} style={input} /></label>
                  <label style={label}>Unvan<input name="role" defaultValue={s.role} style={input} /></label>
                  <label style={label}>Bağlı hesap
                    <select name="userId" defaultValue={s.userId ?? ""} style={input}>
                      <option value="">Bağlı hesap yok</option>
                      {members.map((m) => <option key={m.userId} value={m.userId}>{m.email}</option>)}
                    </select>
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" disabled={busy} style={{ padding: "8px 14px", borderRadius: 10, border: 0, background: "var(--plum-700)", color: "#fff", cursor: "pointer" }}>Kaydet</button>
                    <button type="button" onClick={() => setEditing(null)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>Vazgeç</button>
                  </div>
                </form>
              ) : (
                <div style={{ display: "grid", gap: 0, borderRadius: 14, background: "var(--subtle)", overflow: "hidden" }}>
                  <Row label="Hesap" value={linked ? linked.email : "Bağlı değil"} muted={!linked} />
                  <Row label="Durum" value={s.active ? "Aktif" : "Pasif"} muted={!s.active} />
                </div>
              )}

              {isOwner && editing !== s.id && (
                <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  <button type="button" disabled={busy} onClick={() => setEditing(s.id)} style={{ background: "none", border: 0, color: "var(--accent)", fontWeight: 700, cursor: "pointer", padding: 0 }}>Detaylar &amp; düzenle →</button>
                  <button type="button" disabled={busy} aria-label={`${s.name} sil`} onClick={() => { if (window.confirm(`${s.name} silinsin mi?`)) run(api(`${base}/${s.id}`, "DELETE", {})); }} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "#b42318", cursor: "pointer" }}>✕</button>
                </footer>
              )}
            </article>
          );
        })}

        {isOwner && !adding && (
          <button type="button" onClick={() => setAdding(true)} style={{ minHeight: 200, borderRadius: 18, border: "2px dashed var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontWeight: 700 }}>
            + Yeni personel
          </button>
        )}
      </div>

      {isOwner && adding && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const ok = await run(api(base, "POST", { name: f.get("name"), role: f.get("role") }));
            if (ok) { setAdding(false); e.currentTarget.reset(); }
          }}
          style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", alignItems: "end", padding: 16, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)" }}
        >
          <label style={label}>Ad soyad<input name="name" required minLength={2} placeholder="Zeynep Aydın" style={input} /></label>
          <label style={label}>Unvan<input name="role" placeholder="Stilist" style={input} /></label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={busy} style={{ padding: "10px 16px", borderRadius: 10, border: 0, background: "var(--plum-700)", color: "#fff", cursor: "pointer" }}>Ekle</button>
            <button type="button" onClick={() => setAdding(false)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>Vazgeç</button>
          </div>
        </form>
      )}
    </div>
  );
}

function Row({ label: l, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderBottom: "1px solid var(--line)", fontSize: ".9rem" }}>
      <span style={{ color: "var(--muted)" }}>{l}</span>
      <span style={{ color: muted ? "var(--muted)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}
