"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "fiarbu-theme";
const LABELS: Record<Theme, string> = { light: "Açık", dark: "Karanlık", system: "Sistem" };

// Tema seçimi. Tercih yalnızca bu tarayıcıda saklanır; sayfa açılırken layout betiği uygular.
function apply(t: Theme) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

export function ThemeChooser() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark" || saved === "system") setTheme(saved);
    } catch { /* depolama kapalıysa sistem teması kullanılır */ }
  }, []);

  function choose(t: Theme) {
    setTheme(t);
    apply(t);
    try { localStorage.setItem(KEY, t); } catch { /* yoksay */ }
  }

  return (
    <section style={{ display: "grid", gap: 14, padding: 18, borderRadius: 18, border: "1px solid var(--line)", background: "var(--surface)" }}>
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Görünüm</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "#5B5BD6", color: "#fff", fontSize: 20 }}>☾</span>
        <div style={{ display: "grid", gap: 2 }}>
          <strong>Tema</strong>
          <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{LABELS[theme]}</span>
        </div>
      </div>
      <div role="radiogroup" aria-label="Tema" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, padding: 4, borderRadius: 14, background: "var(--bg)", border: "1px solid var(--line)" }}>
        {(["light", "dark", "system"] as Theme[]).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={theme === t}
            onClick={() => choose(t)}
            style={{ padding: "10px 6px", borderRadius: 10, border: 0, cursor: "pointer", font: "inherit", fontWeight: 700, background: theme === t ? "var(--surface)" : "transparent", color: "var(--text)", boxShadow: theme === t ? "0 1px 3px rgba(11,31,51,.12)" : "none" }}
          >
            {LABELS[t]}
          </button>
        ))}
      </div>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: ".85rem" }}>Sistem seçeneği, cihazınızın görünüm ayarını otomatik takip eder.</p>
    </section>
  );
}
