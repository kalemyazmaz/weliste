// Site içeriği ve ayarlarının tipleri, varsayılanları ve doğrulama kuralları (veritabanı bağımlılığı yok).

export const DISPLAY_FONTS = ["Fraunces", "Georgia"] as const;
export const SANS_FONTS = ["Inter Tight", "Inter", "system-ui"] as const;
export const BUTTON_RADII = ["square", "soft", "pill"] as const;
export const MODES = ["system", "light", "dark"] as const;
export const RADIUS_PX: Record<(typeof BUTTON_RADII)[number], string> = { square: "4px", soft: "12px", pill: "999px" };

export interface LinkItem { label: string; href: string }
export interface HomeContent {
  heroTitle: string; heroText: string; sectorsTitle: string; newTitle: string; featuredTitle: string; showFeatured: boolean;
  planningTitle: string; ctaTitle: string; ctaText: string; ctaButton: string;
}
export interface HeaderContent { showSectorLinks: boolean; links: LinkItem[]; ctaLabel: string; ctaHref: string }
export interface FooterContent { text: string; links: LinkItem[]; credit: string }
export interface ModePalette { primary: string; accent: string; bg: string; surface: string; text: string; muted: string }
export interface ThemeSettings {
  light: ModePalette; dark: ModePalette;
  displayFont: (typeof DISPLAY_FONTS)[number]; sansFont: (typeof SANS_FONTS)[number];
  buttonRadius: (typeof BUTTON_RADII)[number]; defaultMode: (typeof MODES)[number];
}

export const SETTING_KEYS = ["home", "header", "footer", "theme"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export const DEFAULTS: { home: HomeContent; header: HeaderContent; footer: FooterContent; theme: ThemeSettings } = {
  home: {
    heroTitle: "Düğün için doğru firmayı bulun.",
    heroText: "Düğün salonu, fotoğrafçı, organizasyon ve saç-makyaj firmalarını karşılaştırın, teklif isteyin ya da boş tarihe randevu alın.",
    sectorsTitle: "Ne arıyorsunuz?", newTitle: "Yeni firmalar", featuredTitle: "Öne çıkan firmalar", showFeatured: true,
    planningTitle: "Düğün planlarken",
    ctaTitle: "İşletmenizi ekleyin",
    ctaText: "Profilinizi açın, hizmetlerinizi ve boş tarihlerinizi yayınlayın. Müşteriler sizi bulup teklif isteyebilir.",
    ctaButton: "Ücretsiz başlayın",
  },
  header: { showSectorLinks: true, links: [], ctaLabel: "", ctaHref: "" },
  footer: {
    text: "Weliste · Düğün ve etkinlik firmaları için randevu ve teklif platformu.",
    links: [{ label: "Gizlilik", href: "/yasal/gizlilik" }, { label: "KVKK aydınlatma", href: "/yasal/kvkk" }, { label: "Veri silme", href: "/yasal/veri-silme" }],
    credit: "",
  },
  theme: {
    light: { primary: "#134455", accent: "#134455", bg: "#E9E8E3", surface: "#FFFFFF", text: "#252829", muted: "#4F5557" },
    dark: { primary: "#2F6A7D", accent: "#8DBFCD", bg: "#252829", surface: "#2E3335", text: "#E9E8E3", muted: "#B3B7B3" },
    displayFont: "Fraunces", sansFont: "Inter Tight", buttonRadius: "pill", defaultMode: "system",
  },
};

const HEX = /^#[0-9A-Fa-f]{6}$/;
export type Fields = string[];

function str(v: unknown, max: number, min = 0): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < min || t.length > max) return null;
  return t;
}
function href(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t === "") return "";
  if (t.startsWith("/") && !t.startsWith("//")) return t.slice(0, 300);
  if (t.startsWith("https://") && t.length <= 300) return t;
  return null;
}
function links(v: unknown, max: number, bad: Fields, field: string): LinkItem[] {
  if (!Array.isArray(v) || v.length > max) { bad.push(field); return []; }
  const out: LinkItem[] = [];
  for (const x of v) {
    const o = (x ?? {}) as Record<string, unknown>;
    const label = str(o.label, 30, 1); const h = href(o.href);
    if (!label || !h) { bad.push(field); return []; }
    out.push({ label, href: h });
  }
  return out;
}
function bool(v: unknown): boolean | null { return typeof v === "boolean" ? v : null; }

// Ham değeri doğrular ve temizler. Hatalı alanlar `bad` listesine eklenir.
export function sanitizeSetting(key: SettingKey, raw: unknown, bad: Fields): unknown {
  const o = (raw ?? {}) as Record<string, unknown>;
  if (key === "home") {
    const t = (name: string, max: number, min = 0) => { const v = str(o[name], max, min); if (v === null) { bad.push(name); return ""; } return v; };
    const showFeatured = bool(o.showFeatured); if (showFeatured === null) bad.push("showFeatured");
    return {
      heroTitle: t("heroTitle", 90, 2), heroText: t("heroText", 240), sectorsTitle: t("sectorsTitle", 60), newTitle: t("newTitle", 60),
      featuredTitle: t("featuredTitle", 60), showFeatured: showFeatured ?? true, planningTitle: t("planningTitle", 60),
      ctaTitle: t("ctaTitle", 60), ctaText: t("ctaText", 240), ctaButton: t("ctaButton", 40),
    };
  }
  if (key === "header") {
    const sh = bool(o.showSectorLinks); if (sh === null) bad.push("showSectorLinks");
    const ctaLabel = str(o.ctaLabel ?? "", 30) ?? ""; const ctaHref = href(o.ctaHref ?? "") ?? "";
    if (ctaLabel && !ctaHref) bad.push("ctaHref");
    if (ctaLabel === null) bad.push("ctaLabel");
    return { showSectorLinks: sh ?? true, links: links(o.links ?? [], 6, bad, "links"), ctaLabel, ctaHref };
  }
  if (key === "footer") {
    return { text: str(o.text ?? "", 200) ?? (bad.push("text"), ""), links: links(o.links ?? [], 8, bad, "links"), credit: str(o.credit ?? "", 300) ?? (bad.push("credit"), "") };
  }
  // theme
  const pal = (name: string): ModePalette => {
    const p = (o[name] ?? {}) as Record<string, unknown>;
    const pick = (f: keyof ModePalette) => { const v = p[f]; if (typeof v !== "string" || !HEX.test(v)) { bad.push(`${name}.${f}`); return "#000000"; } return v; };
    return { primary: pick("primary"), accent: pick("accent"), bg: pick("bg"), surface: pick("surface"), text: pick("text"), muted: pick("muted") };
  };
  const pick = <T extends readonly string[]>(v: unknown, list: T, field: string): T[number] => {
    if (typeof v !== "string" || !(list as readonly string[]).includes(v)) { bad.push(field); return list[0]; }
    return v as T[number];
  };
  return {
    light: pal("light"), dark: pal("dark"),
    displayFont: pick(o.displayFont, DISPLAY_FONTS, "displayFont"), sansFont: pick(o.sansFont, SANS_FONTS, "sansFont"),
    buttonRadius: pick(o.buttonRadius, BUTTON_RADII, "buttonRadius"), defaultMode: pick(o.defaultMode, MODES, "defaultMode"),
  };
}
