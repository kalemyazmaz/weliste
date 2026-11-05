"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HeaderContent, HomeContent, FooterContent, LinkItem } from "@/lib/site-defaults";
import { adminCall, btn, card, input, label, primary } from "../ui";

function LinksEditor({ value, onChange, max }: { value: LinkItem[]; onChange: (v: LinkItem[]) => void; max: number }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {value.map((l, i) => (
        <div key={i} style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr) auto" }}>
          <input aria-label="Bağlantı adı" value={l.label} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Ad" style={input} />
          <input aria-label="Bağlantı adresi" value={l.href} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))} placeholder="/randevu veya https://" style={input} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} style={{ ...btn, color: "#b42318" }}>Sil</button>
        </div>
      ))}
      {value.length < max && <button type="button" onClick={() => onChange([...value, { label: "", href: "/" }])} style={{ ...btn, justifySelf: "start" }}>Bağlantı ekle</button>}
    </div>
  );
}

function SaveRow({ busy, msg, onSave }: { busy: boolean; msg: { ok: boolean; text: string } | null; onSave: () => void }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" onClick={onSave} disabled={busy} style={primary}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
      {msg && <span role="status" style={{ color: msg.ok ? "#067647" : "#b42318" }}>{msg.text}</span>}
    </div>
  );
}

export function ContentEditor({ home, header, footer }: { home: HomeContent; header: HeaderContent; footer: FooterContent }) {
  const router = useRouter();
  const [h, setH] = useState(home);
  const [hd, setHd] = useState(header);
  const [f, setF] = useState(footer);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string } | null>>({});

  async function save(key: "home" | "header" | "footer", body: unknown) {
    setBusy(key);
    const r = await adminCall(`/api/admin/settings/${key}`, "PUT", body);
    setBusy(null);
    setMsg((m) => ({ ...m, [key]: r.ok ? { ok: true, text: "Kaydedildi." } : { ok: false, text: r.text } }));
    if (r.ok) router.refresh();
  }

  const text = (k: keyof HomeContent, max?: number) => (
    <label style={label} key={k}>{k}<input value={String(h[k])} maxLength={max} onChange={(e) => setH({ ...h, [k]: e.target.value })} style={input} /></label>
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={card}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Ön sayfa metinleri</h2>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <label style={label}>Ana başlık<input value={h.heroTitle} onChange={(e) => setH({ ...h, heroTitle: e.target.value })} style={input} /></label>
          <label style={label}>Ana metin<textarea rows={3} value={h.heroText} onChange={(e) => setH({ ...h, heroText: e.target.value })} style={input} /></label>
          {text("sectorsTitle")}{text("newTitle")}{text("featuredTitle")}{text("planningTitle")}{text("ctaTitle")}
          <label style={label}>Tanıtım metni<textarea rows={2} value={h.ctaText} onChange={(e) => setH({ ...h, ctaText: e.target.value })} style={input} /></label>
          {text("ctaButton")}
          <label style={{ ...label, alignContent: "end" }}><span style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text)" }}><input type="checkbox" checked={h.showFeatured} onChange={(e) => setH({ ...h, showFeatured: e.target.checked })} /> "Öne çıkan firmalar" bölümünü göster</span></label>
        </div>
        <SaveRow busy={busy === "home"} msg={msg.home ?? null} onSave={() => save("home", h)} />
      </section>

      <section style={card}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Header (üst menü)</h2>
        <label style={{ ...label, gridAutoFlow: "column", justifyContent: "start", alignItems: "center" }}><input type="checkbox" checked={hd.showSectorLinks} onChange={(e) => setHd({ ...hd, showSectorLinks: e.target.checked })} /> Sektör bağlantılarını göster</label>
        <div style={{ display: "grid", gap: 6 }}>
          <span style={label}>Ek bağlantılar (en fazla 6)</span>
          <LinksEditor value={hd.links} max={6} onChange={(links) => setHd({ ...hd, links })} />
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label style={label}>Vurgu düğmesi metni<input value={hd.ctaLabel} onChange={(e) => setHd({ ...hd, ctaLabel: e.target.value })} placeholder="boş bırakılırsa gösterilmez" style={input} /></label>
          <label style={label}>Vurgu düğmesi adresi<input value={hd.ctaHref} onChange={(e) => setHd({ ...hd, ctaHref: e.target.value })} placeholder="/kayit" style={input} /></label>
        </div>
        <SaveRow busy={busy === "header"} msg={msg.header ?? null} onSave={() => save("header", hd)} />
      </section>

      <section style={card}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Footer (alt bilgi)</h2>
        <label style={label}>Açıklama<textarea rows={2} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} style={input} /></label>
        <div style={{ display: "grid", gap: 6 }}>
          <span style={label}>Bağlantılar (en fazla 8)</span>
          <LinksEditor value={f.links} max={8} onChange={(links) => setF({ ...f, links })} />
        </div>
        <label style={label}>Kaynak notu (fotoğraf lisansları vb.)<textarea rows={2} value={f.credit} onChange={(e) => setF({ ...f, credit: e.target.value })} style={input} /></label>
        <SaveRow busy={busy === "footer"} msg={msg.footer ?? null} onSave={() => save("footer", f)} />
      </section>
    </div>
  );
}
