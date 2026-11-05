import { Db } from "./db";

// Randevu listesi (sektör sayfaları için ortak tablo). Yayın kapalıysa satır gizlenir, silinmez.
export async function syncBookingListing(db: Db, tenantId: string, sector: string, name: string, city: string, description: string, published: boolean) {
  await db.transaction((tx) =>
    tx.query(
      `INSERT INTO booking_listings (tenant_id, sector, name, city, description, published, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (tenant_id) DO UPDATE SET sector = EXCLUDED.sector, name = EXCLUDED.name, city = EXCLUDED.city,
         description = EXCLUDED.description, published = EXCLUDED.published, updated_at = now()`,
      [tenantId, sector, name, city, description.slice(0, 500), published],
    ),
  );
}
