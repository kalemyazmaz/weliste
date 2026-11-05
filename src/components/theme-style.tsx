import { RADIUS_PX, type ThemeSettings, type ModePalette } from "@/lib/site-defaults";

// Tema CSS'i yalnızca doğrulanmış değerlerden üretilir (renkler #RRGGBB, yazı tipleri ve biçimler listeden).
function vars(p: ModePalette, t: ThemeSettings) {
  return `--plum-700: ${p.primary}; --plum-600: ${p.accent}; --accent: ${p.accent}; --bg: ${p.bg}; --cream: ${p.bg}; --surface: ${p.surface}; --paper: ${p.surface}; --text: ${p.text}; --ink: ${p.text}; --muted: ${p.muted}; --font-display: "${t.displayFont}", Georgia, serif; --font-sans: "${t.sansFont}", system-ui, sans-serif; --btn-radius: ${RADIUS_PX[t.buttonRadius]};`;
}

export function themeCss(t: ThemeSettings): string {
  return [
    `:root { ${vars(t.light, t)} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${vars(t.dark, t)} } }`,
    `:root[data-theme="dark"] { ${vars(t.dark, t)} }`,
    `:root[data-theme="light"] { ${vars(t.light, t)} }`,
    `.btn, .btn--primary, .btn--ghost { border-radius: var(--btn-radius); }`,
  ].join("\n");
}

// Varsayılan görünüm: ziyaretçi tercih etmediyse site ayarındaki mod uygulanır.
export function defaultModeScript(mode: ThemeSettings["defaultMode"]): string {
  if (mode === "system") return "";
  return `try{if(!localStorage.getItem("fiarbu-theme")){document.documentElement.setAttribute("data-theme","${mode}");}}catch(e){}`;
}
