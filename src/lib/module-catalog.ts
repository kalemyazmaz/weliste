// İstemci ve sunucu ortak özellik kataloğu (veritabanı bağımlılığı yok).
// İsteğe bağlı özellikler. Kapatılan özellik yalnızca görünmez olur; veriler silinmez.
// "sectors": modülün hangi işletme türlerinde göründüğü. Boş değil: yalnızca o sektörlerde açılır.
import type { SectorKey } from "./sectors";

const ALL_SECTORS: SectorKey[] = ["dugun-salonu", "fotografci", "organizasyon", "sac-makyaj"];

export const MODULES = [
  { key: "stats", label: "İstatistikler", desc: "Randevu, gelmeme oranı ve doluluk raporları.", def: true, sectors: ALL_SECTORS },
  { key: "ledger", label: "Gelir / Gider (kasa)", desc: "Gelir ve gider defteri, tamamlanan randevuların geliri.", def: true, sectors: ALL_SECTORS },
  { key: "products", label: "Ürünler", desc: "Hizmetle birlikte satılan ürün kataloğu.", def: false, sectors: ALL_SECTORS },
  { key: "payroll", label: "Maaş ve prim planları", desc: "Personel maaşı ve prim ödemelerinin otomatik kasaya yazılması.", def: false, sectors: ALL_SECTORS },
  { key: "notes", label: "Müşteri notları", desc: "Müşteri kartlarında serbest not alanı.", def: true, sectors: ALL_SECTORS },
  { key: "reminders", label: "WhatsApp hatırlatmaları", desc: "Yaklaşan randevular için hatırlatma kuyruğu.", def: true, sectors: ALL_SECTORS },
  { key: "preview", label: "Müşteri sayfası önizlemesi", desc: "İşletme profili sayfasında müşterinin gördüğü sayfanın önizlemesi.", def: true, sectors: ALL_SECTORS },
  { key: "venue_calendar", label: "Seanslı takvim", desc: "Düğün salonu gündüz ve gece seanslarının takvimi, kapora ve fiyat kaydı.", def: true, sectors: ["dugun-salonu"] as SectorKey[] },
  { key: "venue_inquiries", label: "Teklif talepleri", desc: "Müşterinin sitenizden gönderdiği teklif talepleri.", def: true, sectors: ["dugun-salonu", "organizasyon"] as SectorKey[] },
  { key: "org_events", label: "Etkinlik projeleri", desc: "Etkinlik kayıtları: müşteri, tarih, mekân, durum ve ekip ataması.", def: true, sectors: ["organizasyon"] as SectorKey[] },
  { key: "org_tasks", label: "Görev listesi", desc: "Her etkinlik için yapılacaklar listesi ve ilerleme takibi.", def: true, sectors: ["organizasyon"] as SectorKey[] },
  { key: "org_budget", label: "Etkinlik bütçesi", desc: "Etkinlik bütçesi, giderler ve ödenen / bekleyen tutarlar.", def: true, sectors: ["organizasyon"] as SectorKey[] },
  { key: "venue_suppliers", label: "Tedarikçiler", desc: "Müzik, fotoğraf, çiçek ve yemek gibi düğün tedarikçilerinin listesi.", def: true, sectors: ["dugun-salonu"] as SectorKey[] },
  { key: "venue_share", label: "Paylaşım linkleri", desc: "Müsaitlik takvimini kimlik bilgisi olmadan çiftlerle paylaşan linkler.", def: true, sectors: ["dugun-salonu"] as SectorKey[] },
  { key: "bridal_files", label: "Gelin dosyaları", desc: "Gelin ve davet müşterileri: düğün tarihi, deneme, paket ve durum takibi.", def: true, sectors: ["sac-makyaj"] as SectorKey[] },
  { key: "photo_delivery", label: "Fotoğraf teslim ve seçimi", desc: "Müşteriye özel link ile fotoğraf seçtirme ve seçimleri alma.", def: true, sectors: ["fotografci"] as SectorKey[] },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export type Modules = Record<ModuleKey, boolean>;

// Bir işletme türünde görünen modüller.
export function modulesForSector(sector: string | null | undefined) {
  return MODULES.filter((m) => (m.sectors as readonly string[]).includes(sector ?? ""));
}

export function moduleAppliesTo(key: string, sector: string | null | undefined): boolean {
  return modulesForSector(sector).some((m) => m.key === key);
}
