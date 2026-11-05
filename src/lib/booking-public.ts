import { Db, withTenant } from "./db";
import { getTenant } from "./service";
import { SectorKey } from "./sectors";

// Müşteri tarafı okumaları (oturumsuz). Yalnızca yayındaki işletmeler görünür.

export interface SectorListing {
  tenantId: string;
  name: string;
  city: string;
  description: string;
}

export async function listSectorListings(db: Db, sector: SectorKey): Promise<SectorListing[]> {
  const res = await db.transaction((tx) =>
    tx.query<Record<string, unknown>>(
      "SELECT tenant_id, name, city, description FROM booking_listings WHERE sector = $1 AND published ORDER BY name",
      [sector],
    ),
  );
  return res.rows.map((r) => ({
    tenantId: String(r.tenant_id),
    name: String(r.name),
    city: String(r.city),
    description: String(r.description),
  }));
}

export interface HomeListing { tenantId: string; name: string; city: string; sector: SectorKey; description: string }

// Ana sayfa: en yeni yayındaki firmalar ve öne çıkanlar (sektör sınırı yok).
export async function listHomeListings(db: Db): Promise<{ newest: HomeListing[]; featured: HomeListing[] }> {
  const res = await db.transaction((tx) =>
    tx.query<Record<string, unknown>>(
      "SELECT tenant_id, name, city, sector, description, featured FROM booking_listings WHERE published ORDER BY updated_at DESC LIMIT 60",
    ),
  );
  const all = res.rows.map((r) => ({
    tenantId: String(r.tenant_id), name: String(r.name), city: String(r.city), sector: r.sector as SectorKey,
    description: String(r.description), featured: Boolean(r.featured),
  }));
  return {
    newest: all.slice(0, 6).map(({ featured: _f, ...x }) => x),
    featured: all.filter((x) => x.featured).slice(0, 6).map(({ featured: _f, ...x }) => x),
  };
}

export interface BookingPageData {
  tenantId: string;
  name: string;
  city: string;
  sector: SectorKey;
  description: string;
  services: Array<{ id: string; name: string; priceTl: number; durationMin: number; guestCount: number | null; menu: string | null }>;
  staff: Array<{ id: string; name: string; role: string }>;
}

// Randevu sayfası verisi. Sektörü olmayan veya yayında olmayan işletme için null döner.
export async function getBookingPage(db: Db, tenantId: string): Promise<BookingPageData | null> {
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !tenant.sector) return null;
  return withTenant(db, tenantId, async (tx) => {
    const p = await tx.query<Record<string, unknown>>("SELECT published, description FROM tenant_profiles WHERE tenant_id = $1", [tenantId]);
    if (!p.rows[0] || !p.rows[0].published) return null;
    const services = await tx.query<Record<string, unknown>>(
      "SELECT id, name, price_tl::text AS price_tl, duration_min, guest_count, menu FROM services ORDER BY created_at",
    );
    const staff = await tx.query<Record<string, unknown>>("SELECT id, name, role FROM staff ORDER BY created_at");
    return {
      tenantId: tenant.id,
      name: tenant.name,
      city: tenant.city,
      sector: tenant.sector as SectorKey,
      description: String(p.rows[0].description ?? ""),
      services: services.rows.map((s) => ({
        id: String(s.id),
        name: String(s.name),
        priceTl: Number(s.price_tl),
        durationMin: Number(s.duration_min),
        guestCount: s.guest_count === null ? null : Number(s.guest_count),
        menu: s.menu ? String(s.menu) : null,
      })),
      staff: staff.rows.map((s) => ({ id: String(s.id), name: String(s.name), role: String(s.role) })),
    };
  });
}

export interface SectorCard {
  tenantId: string; name: string; city: string; description: string; sector: SectorKey;
  logo: string | null; cover: string | null;
  services: string[]; serviceCount: number; minPriceTl: number | null;
}

// Liste kartları: logo, kapak, konum, hizmet adları ve en düşük fiyat.
// Kiracıya özel tablolar (profil, hizmetler) kiracı bağlamında okunur.
export async function toSectorCards(db: Db, listings: Array<{ tenantId: string; name: string; city: string; description: string; sector: SectorKey }>): Promise<SectorCard[]> {
  return Promise.all(
    listings.map((l) =>
      withTenant(db, l.tenantId, async (tx) => {
        const p = await tx.query<{ logo: string | null; cover: string | null }>("SELECT logo, cover FROM tenant_profiles");
        const s = await tx.query<{ name: string; price: string }>("SELECT name, price_tl::text AS price FROM services ORDER BY created_at");
        const prices = s.rows.map((x) => Number(x.price)).filter((x) => x > 0);
        return {
          tenantId: l.tenantId, name: l.name, city: l.city, description: l.description, sector: l.sector,
          logo: p.rows[0]?.logo ?? null, cover: p.rows[0]?.cover ?? null,
          services: s.rows.map((x) => String(x.name)), serviceCount: s.rows.length,
          minPriceTl: prices.length ? Math.min(...prices) : null,
        } satisfies SectorCard;
      }),
    ),
  );
}

export async function listSectorCards(db: Db, sector: SectorKey, limit = 24): Promise<SectorCard[]> {
  return toSectorCards(db, (await listSectorListings(db, sector)).slice(0, limit).map((l) => ({ ...l, sector })));
}
