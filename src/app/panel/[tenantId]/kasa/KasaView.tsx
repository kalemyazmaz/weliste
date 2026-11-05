"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { LedgerView } from "@/lib/ledger";

const TRY = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 });
const DT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)" } as const;
const SEKMELER = [["tumu", "Tümü"], ["gelir", "Gelirler"], ["gider", "Giderler"], ["personel", "Personel"]] as const;
const DONEMLER = [["bugun", "Bugün"], ["hafta", "Bu hafta"], ["ay", "Bu ay"], ["tumu", "Tüm zamanlar"]] as const;

// Kasa: sekmeler, dönem/kategori filtreleri, arama, özet kartları ve işlem listesi.
export function KasaView({ tenantId, view, sekme, donem, kategori, q, staff, services, products, customers, personel }: {
  tenantId: string; view: LedgerView; sekme: string; donem: string; kategori: string; q: string; staff: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; priceTl: number }>; products: Array<{ id: string; name: string; priceTl: number }>;
  customers: Array<{ phone: string; name: string }>; personel: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [adding, setAdding] = useState(false);

  function go(patch: Record<string, string>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    router.push(`${path}?${next.toString()}`);
  }

  const { summary } = view;
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
        <div role="tablist" aria-label="İşlem türü" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)" }}>
          {SEKMELER.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={sekme === k} type="button" onClick={() => go({ sekme: k })} style={{ padding: "8px 14px", borderRadius: 10, border: 0, cursor: "pointer", fontWeight: 700, background: sekme === k ? "var(--subtle)" : "transparent", color: "var(--text)" }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <select aria-label="Dönem" value={donem} onChange={(e) => go({ donem: e.target.value })} style={input}>
            {DONEMLER.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select aria-label="Kategori" value={kategori} onChange={(e) => go({ kategori: e.target.value })} style={input}>
            <option value="">Tüm kategoriler</option>
            {view.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input aria-label="Ara" defaultValue={q} placeholder="İşlem, kategori veya fiş no ara…" onKeyDown={(e) => { if (e.key === "Enter") go({ q: (e.target as HTMLInputElement).value }); }} style={{ ...input, minWidth: 240 }} />
          <button type="button" onClick={() => setAdding(true)} aria-label="Yeni kayıt" style={{ width: 44, height: 44, borderRadius: 12, border: 0, background: "var(--accent)", color: "#fff", fontSize: 22, cursor: "pointer" }}>+</button>
        </div>
      </div>

      {sekme === "personel" && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }} role="group" aria-label="Personel seç">
          {staff.map((s) => {
            const active = personel === s.id;
            return (
              <button key={s.id} type="button" aria-pressed={active} onClick={() => go({ personel: active ? "" : s.id })} style={{ display: "grid", justifyItems: "center", gap: 6, background: "none", border: 0, cursor: "pointer", color: active ? "var(--accent)" : "var(--text)" }}>
                <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, color: "#fff", background: "linear-gradient(135deg, var(--plum-700), var(--accent))", outline: active ? "3px solid var(--accent)" : "none", outlineOffset: 3 }}>{s.name.trim()[0]?.toUpperCase() ?? "?"}</span>
                <span style={{ fontSize: ".88rem", fontWeight: active ? 700 : 500 }}>{s.name}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Stat label="Toplam gelir" value={TRY.format(summary.income)} tone="#15803d" />
        <Stat label="Toplam gider" value={TRY.format(summary.expense)} tone="#b91c1c" />
        <Stat label="Kâr / zarar marjı" value={`%${(summary.margin * 100).toFixed(1)}`} />
        <Stat label="Net durum" value={TRY.format(summary.net)} tone={summary.net >= 0 ? "#15803d" : "#b91c1c"} />
      </div>

      <section style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>İşlem geçmişi</h2>
        {view.entries.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>Bu filtrelerde işlem yok. Randevu tamamlandığında hizmet bedeli otomatik gelir olarak yazılır.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
            {view.entries.map((e) => {
              const inc = e.kind === "gelir";
              return (
                <li key={e.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)" }}>
                  <div aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", fontWeight: 800, color: inc ? "#15803d" : "#b91c1c", background: inc ? "#dcfce7" : "#fee2e2" }}>{inc ? "↗" : "↘"}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.category}</strong>
                    <span style={{ color: "var(--muted)", fontSize: ".86rem" }}>
                      {inc ? "Gelir" : "Gider"} · {({ nakit: "Nakit", kart: "Kart", havale: "Havale" } as Record<string, string>)[e.method] ?? e.method}
                      {e.staffName ? ` · Personel: ${e.staffName}` : ""}
                    </span>
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <strong style={{ color: inc ? "#15803d" : "#b91c1c" }}>{inc ? "+" : "−"}{TRY.format(e.amountTl)}</strong>
                    <div style={{ color: "var(--muted)", fontSize: ".78rem" }}>#{e.receiptNo} · {DT.format(new Date(e.occurredAt))}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {adding && <LedgerForm tenantId={tenantId} staff={staff} services={services} products={products} customers={customers} categories={view.categories} onClose={() => setAdding(false)} />}

    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ padding: 18, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)", display: "grid", gap: 8 }}>
      <span style={{ color: "var(--muted)", fontSize: ".78rem", letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
      <strong style={{ fontSize: "1.5rem", color: tone ?? "var(--text)" }}>{value}</strong>
    </div>
  );
}

function LedgerForm({ tenantId, staff, services, products, customers, onClose }: {
  tenantId: string;
  staff: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; priceTl: number }>;
  products: Array<{ id: string; name: string; priceTl: number }>;
  customers: Array<{ phone: string; name: string }>;
  categories: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date());
  const [kind, setKind] = useState<"gelir" | "gider">("gelir");
  const [items, setItems] = useState<Array<{ key: number; name: string; amount: string; fixed: boolean; staffId?: string }>>([]);
  const [nextKey, setNextKey] = useState(1);
  const [pick, setPick] = useState<null | "service" | "product" | "staff">(null);
  const [method, setMethod] = useState<"nakit" | "kart" | "havale">("nakit");
  const [customer, setCustomer] = useState<{ phone: string; name: string } | null>(null);
  const [custQ, setCustQ] = useState("");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = items.reduce((a, i) => a + (Number(i.amount) || 0), 0);
  const custHits = custQ.trim().length >= 2
    ? customers.filter((c) => c.name.toLocaleLowerCase("tr-TR").includes(custQ.trim().toLocaleLowerCase("tr-TR")) || c.phone.includes(custQ.trim())).slice(0, 5)
    : [];
  const chip = (active: boolean) => ({ flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", cursor: "pointer", fontWeight: 700, background: active ? "var(--accent)" : "transparent", color: active ? "#fff" : "var(--text)" } as const);

  function add(item: { name: string; amount: string; fixed: boolean; staffId?: string }) {
    setItems((prev) => [...prev, { key: nextKey, ...item }]);
    setNextKey(nextKey + 1);
    setPick(null);
  }
  const presets = kind === "gelir" ? [] : ["Kira", "Fatura", "Malzeme"];
  const pickOptions = pick === "service" ? services.map((s) => ({ id: s.id, label: `${s.name}${s.priceTl > 0 ? ` · ${s.priceTl} TL` : ""}`, name: s.name, amount: String(s.priceTl || "") }))
    : pick === "product" ? products.map((p) => ({ id: p.id, label: `${p.name} · ${p.priceTl} TL`, name: p.name, amount: String(p.priceTl || "") }))
    : pick === "staff" ? staff.map((s) => ({ id: s.id, label: s.name, name: `Personel ödemesi · ${s.name}`, amount: "", staffId: s.id }))
    : [];

  async function save() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/tenants/${tenantId}/ledger`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        items: items.map((i) => ({ name: i.name, amountTl: i.amount, staffId: i.staffId ?? null })),
        method,
        customerPhone: customer?.phone ?? null,
        occurredAt: date,
      }),
    });
    setBusy(false);
    if (!res.ok) { setError("Kayıt eklenemedi. Kalemleri, tutarları ve tarihi kontrol edin."); return; }
    onClose();
    router.refresh();
  }

  const chipLabels = kind === "gelir" ? (products.length > 0 ? ["Hizmet", "Ürün"] : ["Hizmet"]) : ["Personel"];

  return (
    <div role="dialog" aria-modal="true" aria-label="Yeni kasa kaydı" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(5, 12, 20, .6)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)", maxHeight: "92vh", overflow: "auto", background: "var(--surface)", borderRadius: 24, border: "1px solid var(--line)", padding: 24, display: "grid", gap: 18 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: "1.2rem" }}>{kind === "gelir" ? "Yeni gelir ekle" : "Yeni gider ekle"}</strong>
          <button type="button" onClick={onClose} aria-label="Kapat" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>✕</button>
        </header>

        <div style={{ display: "flex", gap: 6, padding: 4, borderRadius: 14, border: "1px solid var(--line)" }}>
          {(["gelir", "gider"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setPick(null); }} style={{ ...chip(kind === k), border: 0, background: kind === k ? (k === "gelir" ? "#15803d" : "#b91c1c") : "transparent", color: kind === k ? "#fff" : "var(--text)" }}>{k === "gelir" ? "Gelir" : "Gider"}</button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <span style={{ fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>İşlem</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {chipLabels.map((c) => {
              const key = c === "Hizmet" ? "service" : c === "Ürün" ? "product" : "staff";
              return <button key={c} type="button" onClick={() => setPick(pick === key ? null : key)} style={chip(pick === key)}>{c}</button>;
            })}
            {presets.map((p) => (
              <button key={p} type="button" onClick={() => add({ name: p, amount: "", fixed: true })} style={chip(false)}>{p}</button>
            ))}
            <button type="button" onClick={() => add({ name: "", amount: "", fixed: false })} style={chip(false)}>+ Diğer</button>
          </div>
          {pick && (
            <div style={{ display: "grid", gap: 6, padding: 8, borderRadius: 14, border: "1px solid var(--line)" }}>
              {pickOptions.length === 0 ? <span style={{ color: "var(--muted)" }}>Bu listede henüz kayıt yok.</span> : pickOptions.map((o) => (
                <button key={o.id} type="button" onClick={() => add({ name: o.name, amount: o.amount, fixed: true, staffId: (o as { staffId?: string }).staffId })} style={{ textAlign: "left", padding: 10, borderRadius: 10, border: 0, background: "var(--subtle)", color: "var(--text)", cursor: "pointer" }}>{o.label}</button>
              ))}
            </div>
          )}
          {items.length === 0 ? (
            <div style={{ padding: 18, borderRadius: 14, border: "2px dashed var(--line)", textAlign: "center", color: "var(--muted)", fontSize: ".9rem" }}>
              Henüz işlem eklenmedi. Yukarıdan bir kalem seçin.
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {items.map((it) => (
                <li key={it.key} style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 8, alignItems: "center" }}>
                  <input aria-label="Kalem adı" value={it.name} readOnly={it.fixed} placeholder="Açıklama" maxLength={80} onChange={(e) => setItems((p) => p.map((x) => (x.key === it.key ? { ...x, name: e.target.value } : x)))} style={input} />
                  <input aria-label="Tutar" type="number" min={0.01} step="0.01" value={it.amount} placeholder="0,00" onChange={(e) => setItems((p) => p.map((x) => (x.key === it.key ? { ...x, amount: e.target.value } : x)))} style={input} />
                  <button type="button" aria-label="Kalemi kaldır" onClick={() => setItems((p) => p.filter((x) => x.key !== it.key))} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "#b42318", cursor: "pointer" }}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>Müşteri (isteğe bağlı)</span>
          {customer ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 12, background: "var(--subtle)" }}>
              <span>{customer.name || "İsimsiz"} · {customer.phone}</span>
              <button type="button" onClick={() => setCustomer(null)} aria-label="Müşteriyi kaldır" style={{ border: 0, background: "transparent", color: "var(--text)", cursor: "pointer" }}>✕</button>
            </div>
          ) : (
            <>
              <input value={custQ} onChange={(e) => setCustQ(e.target.value)} placeholder="Müşteri ara (en az 2 harf)…" aria-label="Müşteri ara" style={input} />
              {custHits.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
                  {custHits.map((c) => (
                    <li key={c.phone}><button type="button" onClick={() => { setCustomer(c); setCustQ(""); }} style={{ width: "100%", textAlign: "left", padding: 10, borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>{c.name || "İsimsiz"} · {c.phone}</button></li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>Ödeme yöntemi</span>
          <div style={{ display: "flex", gap: 8 }}>
            {(["nakit", "kart", "havale"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)} style={chip(method === m)}>{({ nakit: "Nakit", kart: "Kart", havale: "Havale" })[m]}</button>
            ))}
          </div>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>Tarih
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} style={input} />
        </label>

        {error && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{error}</p>}

        <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <div>
            <span style={{ color: "var(--muted)", fontSize: ".82rem" }}>Toplam</span>
            <strong style={{ display: "block", fontSize: "1.3rem" }}>{TRY.format(total)}</strong>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: "11px 16px", borderRadius: 12, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>İptal</button>
            <button type="button" disabled={busy || items.length === 0 || items.some((i) => !i.name.trim() || !(Number(i.amount) > 0))} onClick={save} style={{ padding: "11px 18px", borderRadius: 12, border: 0, background: "#15803d", color: "#fff", cursor: "pointer", fontWeight: 700, opacity: busy || items.length === 0 ? 0.5 : 1 }}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
