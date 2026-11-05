"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerNote } from "./CustomerNote";
import { PhotoField } from "./PhotoField";
import { DATE_TIME_FMT, STATUS, initial, phoneLabel } from "./format";

interface Detail {
  phone: string; name: string; email: string; birthDate: string | null; gender: string; photo: string | null; createdAt: string | null; note: string;
  history: Array<{ id: string; serviceName: string; startsAt: string; status: string; staffId: string | null }>;
}

const input = { padding: "9px 10px", borderRadius: 10, border: "1px solid var(--line)", font: "inherit", width: "100%", background: "var(--surface)", color: "var(--text)" } as const;
const label = { display: "grid", gap: 4, fontSize: ".82rem", color: "var(--muted)" } as const;

// Müşteri detay penceresi: profil, düzenleme, not ve randevu geçmişi.
export function CustomerModal({ tenantId, phone, isOwner, staffNames, notes, onClose }: {
  tenantId: string; phone: string; isOwner: boolean; staffNames: Record<string, string>; notes: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeInto, setMergeInto] = useState("");

  async function removeRecord() {
    if (!window.confirm("Bu müşterinin profil bilgileri ve notu silinsin mi? Randevu geçmişi korunur.")) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/tenants/${tenantId}/customers/${phone}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    if (res.ok) { router.refresh(); onClose(); } else setError("Müşteri silinemedi.");
  }

  async function mergeNow(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!window.confirm("Bu müşterinin randevuları hedef müşteriye taşınacak. Devam edilsin mi?")) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/tenants/${tenantId}/customers/${phone}/merge`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ into: mergeInto }),
    });
    setBusy(false);
    if (res.ok) { router.refresh(); onClose(); return; }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(body.error === "not_found" ? "Hedef müşteri bulunamadı." : "Birleştirilemedi. Telefonu kontrol edin.");
  }

  useEffect(() => {
    let alive = true;
    fetch(`/api/tenants/${tenantId}/customers/${phone}`).then(async (r) => {
      if (!alive) return;
      if (!r.ok) { setMissing(true); return; }
      const data = (await r.json()) as Detail;
      setD(data);
      setPhoto(data.photo);
    });
    return () => { alive = false; };
  }, [tenantId, phone]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    const res = await fetch(`/api/tenants/${tenantId}/customers/${phone}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: f.get("name"), email: f.get("email"), birthDate: f.get("birthDate"), gender: f.get("gender"), photo }),
    });
    setBusy(false);
    if (!res.ok) { setError("Kaydedilemedi. Alanları kontrol edin."); return; }
    setEditing(false);
    router.refresh();
    const fresh = (await (await fetch(`/api/tenants/${tenantId}/customers/${phone}`)).json()) as Detail;
    setD(fresh);
  }

  const waHref = `https://wa.me/${phone}`;

  return (
    <div role="dialog" aria-modal="true" aria-label="Müşteri detayı" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(5, 12, 20, .6)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(960px, 100%)", maxHeight: "92vh", overflow: "auto", background: "var(--surface)", borderRadius: 22, border: "1px solid var(--line)", display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr" }} className="customer-modal">
        {missing ? (
          <div style={{ padding: 24 }}><p style={{ margin: 0 }}>Müşteri bulunamadı.</p></div>
        ) : !d ? (
          <div style={{ padding: 24 }}><p style={{ margin: 0, color: "var(--muted)" }}>Yükleniyor…</p></div>
        ) : (
          <>
            <section style={{ padding: 22, display: "grid", gap: 16, alignContent: "start", borderRight: "1px solid var(--line)" }}>
              <header style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {d.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.photo} alt="" width={56} height={56} style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover" }} />
                ) : (
                  <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 14, display: "grid", placeItems: "center", fontWeight: 800, color: "#fff", background: "linear-gradient(135deg, var(--plum-700), var(--accent))" }}>{initial(d.name || "M")}</div>
                )}
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: "1.1rem" }}>{d.name || "İsimsiz müşteri"}</strong>
                  <span style={{ color: "var(--muted)", fontSize: ".85rem" }}>Kayıt: {d.createdAt ? DATE_TIME_FMT.format(new Date(d.createdAt)) : "—"}</span>
                </div>
                <button type="button" onClick={onClose} aria-label="Kapat" style={{ marginLeft: "auto", width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>✕</button>
              </header>

              {isOwner && (
                <div style={{ display: "grid", gap: 8 }}>
                  {!mergeOpen ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => setMergeOpen(true)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>Birleştir</button>
                      <button type="button" disabled={busy} onClick={removeRecord} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "#b42318", cursor: "pointer" }}>Profili sil</button>
                    </div>
                  ) : (
                    <form onSubmit={mergeNow} style={{ display: "grid", gap: 8 }}>
                      <label style={label}>Hedef müşterinin telefonu<input value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} required placeholder="05XX XXX XX XX" style={input} /></label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="submit" disabled={busy} style={{ padding: "8px 12px", borderRadius: 10, border: 0, background: "var(--plum-700)", color: "#fff", cursor: "pointer" }}>Birleştir</button>
                        <button type="button" onClick={() => setMergeOpen(false)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>Vazgeç</button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={waHref} target="_blank" rel="noopener noreferrer" style={{ padding: "8px 14px", borderRadius: 10, background: "#25d366", color: "#fff", textDecoration: "none", fontWeight: 700 }}>WhatsApp</a>
                {!editing && <button type="button" onClick={() => setEditing(true)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>Düzenle</button>}
              </div>

              {editing ? (
                <form onSubmit={save} style={{ display: "grid", gap: 10 }}>
                  <PhotoField value={photo} onChange={setPhoto} />
                  <label style={label}>Ad soyad<input name="name" defaultValue={d.name} maxLength={120} style={input} /></label>
                  <label style={label}>E-posta<input name="email" type="email" defaultValue={d.email} style={input} /></label>
                  <label style={label}>Doğum tarihi<input name="birthDate" type="date" defaultValue={d.birthDate ?? ""} style={input} /></label>
                  <label style={label}>Cinsiyet
                    <select name="gender" defaultValue={d.gender} style={input}>
                      <option value="">Belirtilmemiş</option>
                      <option value="kadin">Kadın</option>
                      <option value="erkek">Erkek</option>
                      <option value="belirtilmemis">Belirtmek istemiyorum</option>
                    </select>
                  </label>
                  {error && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{error}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" disabled={busy} style={{ padding: "9px 14px", borderRadius: 10, border: 0, background: "var(--plum-700)", color: "#fff", cursor: "pointer" }}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
                    <button type="button" onClick={() => { setEditing(false); setPhoto(d.photo); }} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>Vazgeç</button>
                  </div>
                </form>
              ) : (
                <dl style={{ display: "grid", gap: 0, margin: 0, borderRadius: 14, background: "var(--subtle)", overflow: "hidden" }}>
                  <Field l="Telefon" v={phoneLabel(d.phone)} />
                  <Field l="E-posta" v={d.email || "—"} />
                  <Field l="Doğum tarihi" v={d.birthDate ? new Date(`${d.birthDate}T12:00:00+03:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }) : "Belirtilmemiş"} />
                  <Field l="Cinsiyet" v={({ kadin: "Kadın", erkek: "Erkek", belirtilmemis: "Belirtmek istemiyorum" } as Record<string, string>)[d.gender] ?? "Belirtilmemiş"} />
                </dl>
              )}

              {notes && <CustomerNote tenantId={tenantId} phone={d.phone} initial={d.note} />}
            </section>

            <section style={{ padding: 22, display: "grid", gap: 14, alignContent: "start" }}>
              <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <strong style={{ fontSize: "1.05rem" }}>Randevu geçmişi ({d.history.length})</strong>
                <Link href={`/panel/${tenantId}/randevular?tel=${d.phone}&ad=${encodeURIComponent(d.name)}`} style={{ padding: "9px 14px", borderRadius: 10, background: "var(--accent)", color: "#fff", textDecoration: "none", fontWeight: 700 }}>+ Yeni randevu</Link>
              </header>
              {d.history.length === 0 ? (
                <p style={{ margin: 0, color: "var(--muted)" }}>Bu müşteriye ait randevu yok.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                  {d.history.map((h) => {
                    const st = STATUS[h.status] ?? STATUS.onaylandi;
                    return (
                      <li key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, border: "1px solid var(--line)", opacity: h.status === "iptal" ? 0.6 : 1 }}>
                        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                          <strong>{h.serviceName}</strong>
                          <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>
                            {DATE_TIME_FMT.format(new Date(h.startsAt))}{h.staffId && staffNames[h.staffId] ? ` · ${staffNames[h.staffId]}` : ""}
                          </span>
                        </div>
                        <span style={{ padding: "4px 10px", borderRadius: 999, background: st.bg, color: st.fg, fontSize: ".8rem", fontWeight: 700, whiteSpace: "nowrap" }}>{st.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ l, v }: { l: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderBottom: "1px solid var(--line)", fontSize: ".9rem" }}>
      <dt style={{ color: "var(--muted)" }}>{l}</dt>
      <dd style={{ margin: 0, textAlign: "right" }}>{v}</dd>
    </div>
  );
}
