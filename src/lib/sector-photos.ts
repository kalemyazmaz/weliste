import type { SectorKey } from "./sectors";

// Sektör fotoğrafları (açık lisanslı; kaynakları public/randevu/credits.json'da).
// Fotoğrafçı için tanınabilir bir kişi kullanılmaz; o sektörde düz renk kullanılır.
export const SECTOR_PHOTO: Partial<Record<SectorKey, { src: string; alt: string }>> = {
  "dugun-salonu": { src: "/randevu/hero-hall-jpg.jpg", alt: "Ahşap oymalı, törensel bir salonun iç görünümü" },
  organizasyon: { src: "/randevu/wedding-table-setting.jpg", alt: "Kır temalı, sade bir organizasyon masası" },
  "sac-makyaj": { src: "/randevu/bride-lying-on-grand-staircase-dejan-nikolic.jpg", alt: "Pembe tüllü gelin, merdivenlerde uzanmış" },
};
