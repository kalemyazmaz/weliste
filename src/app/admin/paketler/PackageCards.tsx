"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MODULES } from "@/lib/module-catalog";
import { adminCall, btn, card, input, label, primary } from "../ui";

interface P { id: string; name: string; priceTl: number; modules: string[]; active: boolean; tenantCount: number }

export function PackageCards({ items }: { items: P[] }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {items.map((p) => <PackageCard key={p.id + p.name + p.priceTl + p.modules.join()} p={p} />)}
    </div>
  );
}

function PackageCard({ p }: { p: P }) {
  const router = useRouter();
  const [name, setName] = useState(p.name);
  const [price, setPrice] = useState(String(p.priceTl));
  const [active, setActive] = useState(p.active);
  const [mods, setMods] = useState<string[]>(p.modules);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    const r = await adminCall(`/api/admin/packages/${p.id}`, "PUT", { name, priceTl: Number(price), modules: mods, active });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.text }); return; }
    setMsg({ ok: true, text: "Paket kaydedildi." });
    router.refresh();
  }

  return (
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong>{p.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {p.tenantCount} işletme</span></strong>
        <code style={{ color: "var(--muted)" }}>{p.id}</code>
      </div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <label style={label}>Ad<input value={name} onChange={(e) => setName(e.target.value)} style={input} /></label>
        <label style={label}>Fiyat (TL / ay)<input type="number" min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} style={input} /></label>
        <label style={{ ...label, alignContent: "end" }}><span style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text)" }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Satışta</span></label>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
        <legend style={{ ...label, marginBottom: 6 }}>Dahil modüller</legend>
        <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {MODULES.map((m) => (
            <label key={m.key} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: ".92rem" }}>
              <input type="checkbox" checked={mods.includes(m.key)} onChange={(e) => setMods(e.target.checked ? [...mods, m.key] : mods.filter((x) => x !== m.key))} />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={save} disabled={busy} style={primary}>{busy ? "Kaydediliyor…" : "Paketi kaydet"}</button>
        <button type="button" onClick={() => { setName(p.name); setPrice(String(p.priceTl)); setActive(p.active); setMods(p.modules); }} style={btn}>Geri al</button>
        {msg && <span role="status" style={{ color: msg.ok ? "#067647" : "#b42318" }}>{msg.text}</span>}
      </div>
    </section>
  );
}
