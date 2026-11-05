"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const input = { padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)", font: "inherit", width: "100%" } as const;
const label = { display: "grid", gap: 4, fontSize: ".85rem", color: "var(--muted)" } as const;

async function call(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: string[] };
  if (res.status === 403) return "Bu işlem için yetkiniz yok";
  if (data.error === "staff_has_appointments") return "Bu personelin gelecek randevuları var. Önce bu randevuları iptal edin.";
  return data.fields?.length ? `Eksik veya hatalı alan: ${data.fields.join(", ")}` : "İşlem tamamlanamadı";
}

export interface ManagerField { name: string; label: string; type?: string; textarea?: boolean; placeholder?: string; required?: boolean }
export interface ManagerItem { id: string; primary: string; secondary?: string; values?: Record<string, string> }

// Ekle/sil listesi (hizmet, personel gibi tenant kayıtları için ortak bileşen).
export function RecordManager({ tenantId, endpoint, fields, items, emptyText, addLabel }: {
  tenantId: string; endpoint: string; fields: ManagerField[]; items: ManagerItem[]; emptyText: string; addLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const base = `/api/tenants/${tenantId}/${endpoint}`;

  async function save(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setError(null);
    const err = await call(`${base}/${id}`, "PATCH", data);
    setBusy(false);
    if (err) return setError(err);
    setEditing(null);
    router.refresh();
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; // await'ten sonra olay nesnesi kullanılamaz; form önce alınır
    const data = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setError(null);
    const err = await call(base, "POST", data);
    setBusy(false);
    if (err) return setError(err);
    form.reset();
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    const err = await call(`${base}/${id}`, "DELETE");
    setBusy(false);
    if (err) return setError(err);
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {items.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>{emptyText}</p>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
          {items.map((it) => (
            <div className="card" key={it.id} style={{ display: "grid", gap: 6 }}>
              <strong style={{ overflowWrap: "anywhere" }}>{it.primary}</strong>
              {it.secondary && <span className="muted" style={{ fontSize: ".9rem", whiteSpace: "pre-line" }}>{it.secondary}</span>}
              {editing === it.id && it.values ? (
                <form onSubmit={(e) => save(e, it.id)} style={{ display: "grid", gap: 8 }}>
                  {fields.map((f) => (
                    <label key={f.name} style={label}>
                      {f.label}
                      <input name={f.name} type={f.type ?? "text"} defaultValue={it.values?.[f.name] ?? ""} required={f.required} style={input} />
                    </label>
                  ))}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn--sm" type="submit" disabled={busy}>Kaydet</button>
                    <button className="btn btn--ghost btn--sm" type="button" onClick={() => setEditing(null)}>Vazgeç</button>
                  </div>
                </form>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  {it.values && <button className="btn btn--ghost btn--sm" type="button" disabled={busy} onClick={() => setEditing(it.id)}>Düzenle</button>}
                  <button className="btn btn--ghost btn--sm" type="button" disabled={busy} onClick={() => remove(it.id)} style={{ justifySelf: "start", marginTop: 4 }}>Sil</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <form onSubmit={add} className="card" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", alignItems: "end" }}>
        {fields.map((f) => (
          <label key={f.name} style={{ ...label, gridColumn: f.textarea ? "1 / -1" : undefined }}>
            {f.label}
            {f.textarea ? (
              <textarea name={f.name} placeholder={f.placeholder} rows={4} style={{ ...input, resize: "vertical" }} required={f.required} />
            ) : (
              <input name={f.name} type={f.type ?? "text"} placeholder={f.placeholder} required={f.required} style={input} />
            )}
          </label>
        ))}
        <div style={{ display: "grid", gap: 6 }}>
          <button className="btn" type="submit" disabled={busy}>{addLabel}</button>
          {error && <small style={{ color: "#b42318" }}>{error}</small>}
        </div>
      </form>
    </div>
  );
}
