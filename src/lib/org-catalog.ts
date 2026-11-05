// Organizasyon sabitleri (veritabanı bağımlılığı yok; istemci ve sunucu ortak).
export const EVENT_STATUSES = ["taslak", "onaylandi", "tamamlandi", "iptal"] as const;
export const COST_CATEGORIES = ["tedarikci", "ekipman", "ulasim", "yemek", "diger"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];
