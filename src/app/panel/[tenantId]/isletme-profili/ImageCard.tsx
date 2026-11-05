"use client";

import { useState, type PointerEvent } from "react";
import { resizeToDataUrl } from "@/components/image-field";
import { DEFAULT_FIT, fitStyle, type ImageFit } from "@/lib/image-fit";

const btn = { padding: "8px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 700, font: "inherit" } as const;
const primary = { ...btn, border: 0, background: "var(--plum-700)", color: "#fff" } as const;

// Görsel kartı: Düzenle (sürükleyerek kaydırma ve yakınlaştırma), Ekle (yeni görsel), Sil.
export function ImageCard({ label, aspect, maxPx, value, fit, disabled, onImageChange, onFitSave }: {
  label: string;
  aspect: string;
  maxPx: number;
  value: string | null;
  fit: ImageFit | null;
  disabled: boolean;
  onImageChange: (v: string | null) => Promise<unknown>;
  onFitSave: (f: ImageFit) => Promise<unknown>;
}) {
  const saved = fit ?? DEFAULT_FIT;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ImageFit>(saved);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const shown = editing ? draft : saved;

  function startEdit() { setDraft(saved); setEditing(true); setErr(null); }
  function cancel() { setDraft(saved); setEditing(false); }

  async function save() {
    setBusy(true);
    await onFitSave(draft);
    setBusy(false);
    setEditing(false);
  }

  async function pick(file: File) {
    setErr(null);
    const data = await resizeToDataUrl(file, maxPx);
    if (!data) { setErr("Görsel okunamadı veya çok büyük."); return; }
    setBusy(true);
    await onImageChange(data);
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm(`${label} silinsin mi?`)) return;
    setBusy(true);
    await onImageChange(null);
    setBusy(false);
    setEditing(false);
  }

  // Sürükleme: imleci hareket ettirmek görseli o yöne kaydırır (fareyi sola çekmek görselin sağını gösterir).
  function down(e: PointerEvent<HTMLDivElement>) {
    if (!editing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY });
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!editing || !drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    setDrag({ x: e.clientX, y: e.clientY });
    setDraft((d) => ({
      ...d,
      x: Math.min(100, Math.max(0, Math.round(d.x - (dx / rect.width) * 100 / d.zoom))),
      y: Math.min(100, Math.max(0, Math.round(d.y - (dy / rect.height) * 100 / d.zoom))),
    }));
  }
  function up() { setDrag(null); }

  const dirty = draft.zoom !== saved.zoom || draft.x !== saved.x || draft.y !== saved.y;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <span style={{ fontSize: ".82rem", color: "var(--muted)", fontWeight: 700 }}>{label}</span>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ position: "relative", width: "100%", aspectRatio: aspect, overflow: "hidden", borderRadius: 16, background: "var(--subtle)", border: editing ? "2px solid var(--accent)" : "1px solid var(--line)", cursor: editing ? (drag ? "grabbing" : "grab") : "default", touchAction: editing ? "none" : "auto", userSelect: "none" }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" draggable={false} style={{ ...fitStyle(shown), pointerEvents: "none" }} />
        ) : (
          <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--muted)", fontSize: ".9rem" }}>Görsel yok</div>
        )}
        {editing && <span style={{ position: "absolute", left: 10, bottom: 10, padding: "4px 10px", borderRadius: 999, background: "rgba(11,31,51,.7)", color: "#fff", fontSize: ".8rem", fontWeight: 700 }}>Sürükleyerek kaydırın</span>}
      </div>

      {editing ? (
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 4, fontSize: ".85rem", color: "var(--muted)", fontWeight: 700 }}>Boyut: %{Math.round(draft.zoom * 100)}
            <input type="range" min={1} max={3} step={0.05} value={draft.zoom} disabled={busy} onChange={(e) => setDraft({ ...draft, zoom: Number(e.target.value) })} style={{ width: "100%", accentColor: "var(--accent)" }} />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={save} disabled={busy || !dirty} style={{ ...primary, opacity: dirty ? 1 : 0.5 }}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
            <button type="button" onClick={cancel} disabled={busy} style={btn}>İptal</button>
            <button type="button" onClick={() => setDraft(DEFAULT_FIT)} disabled={busy} style={btn}>Sıfırla</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={startEdit} disabled={disabled || busy || !value} style={{ ...btn, opacity: value ? 1 : 0.5 }}>Düzenle</button>
          <label style={{ ...btn, display: "inline-block", opacity: disabled || busy ? 0.5 : 1, cursor: disabled || busy ? "default" : "pointer" }}>
            Ekle
            <input type="file" accept="image/*" disabled={disabled || busy} onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) pick(f); }} style={{ display: "none" }} />
          </label>
          {value && <button type="button" onClick={remove} disabled={disabled || busy} style={{ ...btn, color: "#b42318" }}>Sil</button>}
        </div>
      )}
      {err && <p role="alert" style={{ margin: 0, color: "#b42318" }}>{err}</p>}
    </div>
  );
}
