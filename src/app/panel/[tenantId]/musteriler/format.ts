// Müşteri ekranlarında ortak biçimlendirme.
export const DATE_FMT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Istanbul" });
export const DATE_TIME_FMT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

export const fmtDate = (iso: string | null) => (iso ? DATE_FMT.format(new Date(iso)) : "—");

// 905XXXXXXXXX -> +90 5XX XXX XX XX
export function phoneLabel(p: string): string {
  return p.length === 12 && p.startsWith("90") ? `+90 ${p.slice(2, 5)} ${p.slice(5, 8)} ${p.slice(8, 10)} ${p.slice(10)}` : p;
}

export const initial = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

export const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  onaylandi: { label: "Onaylandı", bg: "#e0ecff", fg: "#1d4ed8" },
  tamamlandi: { label: "Tamamlandı", bg: "#dcfce7", fg: "#15803d" },
  gelmedi: { label: "Gelmedi", bg: "#fee2e2", fg: "#b91c1c" },
  iptal: { label: "İptal", bg: "#e5e7eb", fg: "#374151" },
};
