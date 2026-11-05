import type { CSSProperties } from "react";

export const input: CSSProperties = { padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", font: "inherit", background: "var(--surface)", color: "var(--text)", width: "100%" };
export const btn: CSSProperties = { padding: "9px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 700, font: "inherit" };
export const primary: CSSProperties = { ...btn, border: 0, background: "var(--plum-700)", color: "#fff" };
export const card: CSSProperties = { display: "grid", gap: 12, padding: 18, borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface)" };
export const label: CSSProperties = { display: "grid", gap: 4, fontSize: ".85rem", color: "var(--muted)", fontWeight: 700 };

// Yönetim isteği: JSON gönderir, hata alanlarını döndürür.
export async function adminCall(url: string, method: string, body: unknown): Promise<{ ok: true } | { ok: false; text: string }> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { fields?: string[] };
  if (res.status === 403) return { ok: false, text: "Bu işlem için yetkiniz yok." };
  return { ok: false, text: data.fields?.length ? `Hatalı alan: ${data.fields.join(", ")}` : "İşlem tamamlanamadı." };
}
