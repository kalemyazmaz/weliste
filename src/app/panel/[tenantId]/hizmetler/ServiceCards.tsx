"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VENUE_MENUS, venueMenuLabel } from "@/lib/venue-catalog";

interface ServiceItem { id: string; name: string; priceTl: number; durationMin: number; guestCount: number | null; menu: string | null }

const input = { padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)", font: "inherit", width: "100%", background: "var(--surface)", color: "var(--text)" } as const;
const label = { display: "grid", gap: 4, fontSize: ".82rem", color: "var(--muted)" } as const;

async function api(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { fields?: string[] };
  if (res.status === 403) return "Bu işlem için yetkiniz yok.";
  return data.fields?.length ? `Hatalı alan: ${data.fields.join(", ")}` : "İşlem tamamlanamadı.";
}

// Hizmet kartları: süre ve fiyat, düzenleme ve silme. Yalnızca sahip düzenleyebilir.
export function ServiceCards({ tenantId, services, isOwner, sector }: { tenantId: string; services: ServiceItem[]; isOwner: boolean; sector: string | null }) {
  const venue = sector === "dugun-salonu";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const base = `/api/tenants/${tenantId}/services`;

  async function run(p: Promise<string | null>) {
    setBusy(true); setError(null);
    const err = await p;
    setBusy(false);
    if (err) setError(err); else router.refresh();
    return !err;
  }

  const fields = (d?: ServiceItem) => (
    <>
      <label style={label}>Hizmet adı<input name="name" required minLength={2} defaultValue={d?.name} placeholder="Saç kesimi" style={input} /></label>
      {venue ? (
        <>
          <label style={label}>Kişi sayısı<input name="guestCount" type="number" min={1} max={5000} required defaultValue={d?.guestCount ?? ""} placeholder="300" style={input} /></label>
          <label style={label}>Menü<select name="menu" required defaultValue={d?.menu ?? "etli"} style={input}>{VENUE_MENUS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></label>
        </>
      ) : (
        <label style={label}>Süre (dk)<input name="durationMin" type="number" min={1} max={720} required defaultValue={d?.durationMin ?? 60} style={input} /></label>
      )}
      <label style={label}>Fiyat (TL)<input name="priceTl" type="number" min={0} defaultValue={d?.priceTl ?? 0} style={input} /></label>
    </>
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{error}</p>}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {services.map((s) => (
          <article key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, padding: 18, display: "grid", gap: 12 }}>
            {editing === s.id ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const ok = await run(api(`${base}/${s.id}`, "PATCH", venue ? { name: f.get("name"), priceTl: f.get("priceTl"), guestCount: f.get("guestCount"), menu: f.get("menu") } : { name: f.get("name"), durationMin: f.get("durationMin"), priceTl: f.get("priceTl") }));
                  if (ok) setEditing(null);
                }}
                style={{ display: "grid", gap: 8 }}
              >
                {fields(s)}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={busy} style={{ padding: "8px 14px", borderRadius: 10, border: 0, background: "var(--plum-700)", color: "#fff", cursor: "pointer" }}>Kaydet</button>
                  <button type="button" onClick={() => setEditing(null)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>Vazgeç</button>
                </div>
              </form>
            ) : (
              <>
                <strong style={{ fontSize: "1.05rem" }}>{s.name}</strong>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {venue ? (
                    <>
                      <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--subtle)", fontSize: ".85rem" }}>{s.guestCount ?? "–"} kişi</span>
                      <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--subtle)", fontSize: ".85rem" }}>{venueMenuLabel(s.menu) || "Menü seçilmedi"}</span>
                    </>
                  ) : (
                    <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--subtle)", fontSize: ".85rem" }}>{s.durationMin} dk</span>
                  )}
                  <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--subtle)", fontSize: ".85rem" }}>{s.priceTl > 0 ? `${s.priceTl} TL` : "Fiyat belirtilmemiş"}</span>
                </div>
                {isOwner && (
                  <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                    <button type="button" disabled={busy} onClick={() => setEditing(s.id)} style={{ background: "none", border: 0, color: "var(--accent)", fontWeight: 700, cursor: "pointer", padding: 0 }}>Düzenle →</button>
                    <button type="button" disabled={busy} aria-label={`${s.name} sil`} onClick={() => { if (window.confirm(`${s.name} silinsin mi?`)) run(api(`${base}/${s.id}`, "DELETE", {})); }} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "#b42318", cursor: "pointer" }}>✕</button>
                  </footer>
                )}
              </>
            )}
          </article>
        ))}
        {isOwner && !adding && (
          <button type="button" onClick={() => setAdding(true)} style={{ minHeight: 160, borderRadius: 18, border: "2px dashed var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontWeight: 700 }}>
            + Yeni hizmet
          </button>
        )}
      </div>
      {isOwner && adding && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const ok = await run(api(base, "POST", venue ? { name: f.get("name"), priceTl: f.get("priceTl"), guestCount: f.get("guestCount"), menu: f.get("menu") } : { name: f.get("name"), durationMin: f.get("durationMin"), priceTl: f.get("priceTl") }));
            if (ok) { setAdding(false); e.currentTarget.reset(); }
          }}
          style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end", padding: 16, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)" }}
        >
          {fields()}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={busy} style={{ padding: "10px 16px", borderRadius: 10, border: 0, background: "var(--plum-700)", color: "#fff", cursor: "pointer" }}>Ekle</button>
            <button type="button" onClick={() => setAdding(false)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>Vazgeç</button>
          </div>
        </form>
      )}
    </div>
  );
}
