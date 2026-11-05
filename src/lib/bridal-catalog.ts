// Gelin dosyası durumları (veritabanı bağımlılığı yok; istemci ve sunucu ortak).
export const BRIDAL_STATUSES = ["planlandi", "deneme_yapildi", "gelin_gunu", "tamamlandi", "iptal"] as const;
export type BridalStatus = (typeof BRIDAL_STATUSES)[number];
