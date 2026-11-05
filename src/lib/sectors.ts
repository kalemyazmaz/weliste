// Ürünün sektörleri: düğün ve etkinlik odaklı. Anahtarlar veritabanındaki
// tenants.sector CHECK kısıtıyla aynı olmak zorundadır (src/db/schema.sql).

export const SECTOR_KEYS = ["dugun-salonu", "fotografci", "organizasyon", "sac-makyaj"] as const;
export type SectorKey = (typeof SECTOR_KEYS)[number];

export interface Sector {
  key: SectorKey;
  label: string;
  intro: string;
  listingNoun: string; // "Düğün salonları" gibi çoğul başlık
}

export const SECTORS: Record<SectorKey, Sector> = {
  "dugun-salonu": {
    key: "dugun-salonu",
    label: "Düğün salonu",
    intro: "Düğün ve nişan için gündüz ya da gece seansını seçin, teklif isteyin.",
    listingNoun: "Düğün salonları",
  },
  fotografci: {
    key: "fotografci",
    label: "Fotoğrafçı",
    intro: "Düğün ve nişan çekimleri için müsait tarihleri görün, teklif isteyin.",
    listingNoun: "Fotoğrafçılar",
  },
  organizasyon: {
    key: "organizasyon",
    label: "Organizasyon",
    intro: "Etkinlik ve düğün organizasyonu için teklif isteyin.",
    listingNoun: "Organizasyon firmaları",
  },
  "sac-makyaj": {
    key: "sac-makyaj",
    label: "Saç ve makyaj",
    intro: "Gelin ve davet saç-makyajı için deneme ve gün randevusu alın.",
    listingNoun: "Saç ve makyaj stüdyoları",
  },
};

export function isSectorKey(v: unknown): v is SectorKey {
  return typeof v === "string" && (SECTOR_KEYS as readonly string[]).includes(v);
}
