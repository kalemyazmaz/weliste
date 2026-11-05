// Düğün salonu menü seçenekleri (veritabanı bağımlılığı yok; istemci ve sunucu ortak).
export const VENUE_MENUS = [
  { key: "yemeksiz", label: "Yemeksiz" },
  { key: "etli", label: "Etli" },
  { key: "tavuklu", label: "Tavuklu" },
  { key: "balikli", label: "Balıklı" },
  { key: "vejetaryen", label: "Vejetaryen" },
  { key: "karisik", label: "Karışık menü" },
] as const;

export type VenueMenuKey = (typeof VENUE_MENUS)[number]["key"];

export function venueMenuLabel(key: string | null | undefined): string {
  return VENUE_MENUS.find((m) => m.key === key)?.label ?? "";
}

export function isVenueMenu(key: unknown): key is VenueMenuKey {
  return typeof key === "string" && VENUE_MENUS.some((m) => m.key === key);
}
