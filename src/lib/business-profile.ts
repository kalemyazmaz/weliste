import { randomUUID } from "node:crypto";
import { Db, withTenant } from "./db";
import { AppError } from "./errors";
import { audit, getTenant } from "./service";
import { SECTOR_KEYS } from "./sectors";
import { syncBookingListing } from "./booking-listing";
import { parseFit, type ImageFit } from "./image-fit";

// İşletme profili: logo, kapak, konum, telefon, sektör, galeri ve yorumlar.
const IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMG = 600000;

function checkImage(v: unknown, field: string): string | null {
  if (v === null || v === "" || v === undefined) return null;
  if (typeof v !== "string" || v.length > MAX_IMG || !IMG.test(v)) throw new AppError(422, "validation", [field]);
  return v;
}

// Olanak etiketleri: en fazla 20 kısa metin. Geçersizse (strict) null döner.
export function parseAmenities(v: unknown, strict = false): string[] | null {
  if (v === undefined || v === null) return strict ? null : [];
  if (!Array.isArray(v) || v.length > 20) return strict ? null : [];
  const items = v.map((x) => (typeof x === "string" ? x.trim().slice(0, 40) : "")).filter((x) => x.length > 0);
  if (strict && v.some((x) => typeof x !== "string")) return null;
  return [...new Set(items)];
}

export interface BusinessProfile {
  name: string; sector: string | null; logo: string | null; cover: string | null; phone: string; address: string; city: string;
  gallery: Array<{ id: string; data: string }>;
  rating: { average: number; count: number };
  reviews: Array<{ id: string; customerName: string; rating: number; body: string; status: string; createdAt: string }>;
  showServices: boolean; showPrices: boolean;
  logoFit: ImageFit | null; coverFit: ImageFit | null;
  amenities: string[];
}

export async function getBusinessProfile(db: Db, tenantId: string): Promise<BusinessProfile | null> {
  const tenant = await getTenant(db, tenantId);
  if (!tenant) return null;
  return withTenant(db, tenantId, async (tx) => {
    const p = await tx.query<Record<string, unknown>>("SELECT logo, cover, phone, address, show_services, show_prices, logo_fit, cover_fit, amenities FROM tenant_profiles");
    const g = await tx.query<Record<string, unknown>>("SELECT id, data FROM profile_photos ORDER BY created_at");
    const rv = await tx.query<Record<string, unknown>>("SELECT id, customer_name, rating, body, status, created_at FROM reviews ORDER BY created_at DESC LIMIT 100");
    const avg = await tx.query<{ a: string | null; n: number }>("SELECT avg(rating)::text AS a, count(*)::int AS n FROM reviews WHERE status = 'shown'");
    const row = p.rows[0] ?? {};
    return {
      name: tenant.name,
      sector: tenant.sector,
      logo: row.logo ? String(row.logo) : null,
      cover: row.cover ? String(row.cover) : null,
      phone: String(row.phone ?? ""),
      address: String(row.address ?? ""),
      city: tenant.city,
      showServices: row.show_services !== false,
      showPrices: row.show_prices !== false,
      logoFit: parseFit(row.logo_fit),
      coverFit: parseFit(row.cover_fit),
      amenities: parseAmenities(row.amenities) ?? [],
      gallery: g.rows.map((x) => ({ id: String(x.id), data: String(x.data) })),
      rating: { average: avg.rows[0].a ? Number(avg.rows[0].a) : 0, count: Number(avg.rows[0].n) },
      reviews: rv.rows.map((x) => ({ id: String(x.id), customerName: String(x.customer_name), rating: Number(x.rating), body: String(x.body), status: String(x.status), createdAt: new Date(x.created_at as string).toISOString() })),
    };
  });
}

// Kısmi güncelleme: yalnızca gönderilen alanlar değişir. Sektör değişirse sektör listesi de güncellenir.
export async function saveBusinessProfile(db: Db, tenantId: string, raw: unknown, actor?: string): Promise<void> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const bad: string[] = [];
  const phone = "phone" in b ? (typeof b.phone === "string" ? b.phone.trim().slice(0, 30) : "") : null;
  const address = "address" in b ? (typeof b.address === "string" ? b.address.trim().slice(0, 300) : "") : null;
  const sector = "sector" in b ? (typeof b.sector === "string" && (SECTOR_KEYS as readonly string[]).includes(b.sector) ? b.sector : null) : undefined;
  if ("sector" in b && sector === null) bad.push("sector");
  const boolField = (k: string): boolean | null | undefined => {
    if (!(k in b)) return undefined;
    if (typeof b[k] !== "boolean") { bad.push(k); return null; }
    return b[k] as boolean;
  };
  const showServices = boolField("showServices");
  const showPrices = boolField("showPrices");
  const amenities = "amenities" in b ? parseAmenities(b.amenities, true) : undefined;
  if (amenities === null) bad.push("amenities");
  const logoFit = "logoFit" in b ? (b.logoFit === null ? null : parseFit(b.logoFit)) : undefined;
  const coverFit = "coverFit" in b ? (b.coverFit === null ? null : parseFit(b.coverFit)) : undefined;
  if ("logoFit" in b && b.logoFit !== null && logoFit === null) bad.push("logoFit");
  if ("coverFit" in b && b.coverFit !== null && coverFit === null) bad.push("coverFit");
  const logo = "logo" in b ? checkImage(b.logo, "logo") : undefined;
  const cover = "cover" in b ? checkImage(b.cover, "cover") : undefined;
  if (bad.length) throw new AppError(422, "validation", bad);
  const tenant = await getTenant(db, tenantId);
  if (!tenant) throw new AppError(404, "not_found");
  await withTenant(db, tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO tenant_profiles (tenant_id, phone, address, logo, cover, show_services, show_prices, logo_fit, cover_fit, updated_at) VALUES ($1, COALESCE($2, ''), COALESCE($3, ''), $4, $5, COALESCE($8::boolean, true), COALESCE($9::boolean, true), $10::jsonb, $11::jsonb, now())
       ON CONFLICT (tenant_id) DO UPDATE SET
         phone = COALESCE($2, tenant_profiles.phone), address = COALESCE($3, tenant_profiles.address),
         logo = CASE WHEN $6 THEN $4 ELSE tenant_profiles.logo END, cover = CASE WHEN $7 THEN $5 ELSE tenant_profiles.cover END,
         logo_fit = CASE WHEN $12 THEN $10::jsonb ELSE tenant_profiles.logo_fit END, cover_fit = CASE WHEN $13 THEN $11::jsonb ELSE tenant_profiles.cover_fit END,
         show_services = COALESCE($8::boolean, tenant_profiles.show_services), show_prices = COALESCE($9::boolean, tenant_profiles.show_prices),
         amenities = COALESCE($14::jsonb, tenant_profiles.amenities), updated_at = now()`,
      [tenantId, phone, address, logo ?? null, cover ?? null, logo !== undefined, cover !== undefined, showServices ?? null, showPrices ?? null,
        logoFit ?? null, coverFit ?? null, logoFit !== undefined || logo !== undefined, coverFit !== undefined || cover !== undefined, amenities ? JSON.stringify(amenities) : null],
    );
    if (sector) await tx.query("UPDATE tenants SET sector = $2 WHERE id = $1", [tenantId, sector]);
    await audit(tx, tenantId, actor, "business.profile", tenantId, { sector: sector ?? null });
  });
  const fresh = await getTenant(db, tenantId);
  if (fresh?.sector) {
    const prof = await withTenant(db, tenantId, (tx) => tx.query<{ description: string; published: boolean }>("SELECT description, published FROM tenant_profiles"));
    await syncBookingListing(db, tenantId, fresh.sector, fresh.name, fresh.city, prof.rows[0]?.description ?? "", prof.rows[0]?.published ?? false);
  }
}

export async function addGalleryPhoto(db: Db, tenantId: string, raw: unknown, actor?: string): Promise<string> {
  const data = checkImage((raw as Record<string, unknown> | null)?.image, "image");
  if (!data) throw new AppError(422, "validation", ["image"]);
  const id = randomUUID();
  await withTenant(db, tenantId, async (tx) => {
    const n = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM profile_photos");
    if (Number(n.rows[0].n) >= 30) throw new AppError(422, "validation", ["gallery"]);
    await tx.query("INSERT INTO profile_photos (id, tenant_id, data) VALUES ($1, $2, $3)", [id, tenantId, data]);
    await audit(tx, tenantId, actor, "business.photo.add", id, {});
  });
  return id;
}

export async function deleteGalleryPhoto(db: Db, tenantId: string, id: string, actor?: string): Promise<void> {
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("DELETE FROM profile_photos WHERE id = $1 RETURNING id", [id]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "business.photo.delete", id, {});
  });
}

export async function setReviewStatus(db: Db, tenantId: string, id: string, status: unknown, actor?: string): Promise<void> {
  if (status !== "shown" && status !== "hidden" && status !== "pending") throw new AppError(422, "validation", ["status"]);
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("UPDATE reviews SET status = $2 WHERE id = $1 RETURNING id", [id, status]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, `review.${String(status)}`, id, {});
  });
}

// Herkese açık işletme sayfası verisi. Yalnızca yayındaki işletme ve sektörü olan kayıt döner.
export interface PublicBusinessPage {
  tenantId: string; name: string; city: string; sector: string; description: string; phone: string; address: string;
  logo: string | null; cover: string | null; gallery: string[];
  logoFit: ImageFit | null; coverFit: ImageFit | null;
  amenities: string[];
  services: Array<{ id: string; name: string; priceTl: number; durationMin: number }>;
  rating: { average: number; count: number };
  ratingBreakdown: number[]; // [5 yıldız, 4, 3, 2, 1] gösterilen yorum sayıları
  showServices: boolean; showPrices: boolean;
  reviews: Array<{ id: string; customerName: string; rating: number; body: string; createdAt: string }>;
  hoursToday: { open: number; close: number } | null; // null: bugün kapalı
  isOpenNow: boolean;
}

export async function getPublicBusinessPage(db: Db, tenantId: string): Promise<PublicBusinessPage | null> {
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !tenant.sector) return null;
  const sectorKey: string = tenant.sector;
  return withTenant(db, tenantId, async (tx) => {
    const p = await tx.query<Record<string, unknown>>("SELECT published, description, phone, address, logo, cover, opens_min, closes_min, day_hours, show_services, show_prices, logo_fit, cover_fit, amenities FROM tenant_profiles");
    const row = p.rows[0];
    if (!row || !row.published) return null;
    const g = await tx.query<{ data: string }>("SELECT data FROM profile_photos ORDER BY created_at");
    const s = await tx.query<Record<string, unknown>>("SELECT id, name, price_tl::text AS price, duration_min FROM services ORDER BY created_at");
    const avg = await tx.query<{ a: string | null; n: number }>("SELECT avg(rating)::text AS a, count(*)::int AS n FROM reviews WHERE status = 'shown'");
    const bd = await tx.query<{ rating: number; n: number }>("SELECT rating, count(*)::int AS n FROM reviews WHERE status = 'shown' GROUP BY rating");
    const rv = await tx.query<Record<string, unknown>>("SELECT id, customer_name, rating, body, created_at FROM reviews WHERE status = 'shown' ORDER BY created_at DESC LIMIT 20");
    // Bugünün çalışma saatleri (İstanbul)
    const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date());
    const wd = new Date(`${today}T12:00:00+03:00`).getUTCDay();
    const dh = row.day_hours as Array<{ open: number; close: number } | null> | null;
    const hoursToday = Array.isArray(dh) && dh.length === 7
      ? dh[wd] ? { open: Number(dh[wd]!.open), close: Number(dh[wd]!.close) } : null
      : { open: Number(row.opens_min ?? 540), close: Number(row.closes_min ?? 1200) };
    const nowMin = (() => { const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Istanbul" }).format(new Date()).split(":"); return Number(parts[0]) * 60 + Number(parts[1]); })();
    return {
      tenantId,
      name: tenant.name,
      city: tenant.city,
      sector: sectorKey,
      description: String(row.description ?? ""),
      phone: String(row.phone ?? ""),
      address: String(row.address ?? ""),
      logo: row.logo ? String(row.logo) : null,
      cover: row.cover ? String(row.cover) : null,
      gallery: g.rows.map((x) => x.data),
      logoFit: parseFit(row.logo_fit),
      coverFit: parseFit(row.cover_fit),
      amenities: parseAmenities(row.amenities) ?? [],
      services: s.rows.map((x) => ({ id: String(x.id), name: String(x.name), priceTl: Number(x.price), durationMin: Number(x.duration_min) })),
      rating: { average: avg.rows[0].a ? Number(avg.rows[0].a) : 0, count: Number(avg.rows[0].n) },
      ratingBreakdown: [5, 4, 3, 2, 1].map((st) => Number(bd.rows.find((x) => Number(x.rating) === st)?.n ?? 0)),
      showServices: row.show_services !== false,
      showPrices: row.show_prices !== false,
      reviews: rv.rows.map((x) => ({ id: String(x.id), customerName: String(x.customer_name), rating: Number(x.rating), body: String(x.body), createdAt: new Date(x.created_at as string).toISOString() })),
      hoursToday,
      isOpenNow: hoursToday !== null && nowMin >= hoursToday.open && nowMin < hoursToday.close,
    };
  });
}

// Müşterinin yorumu: yayına girmeden önce işletme onaylar (pending).
export async function addPublicReview(db: Db, tenantId: string, raw: unknown): Promise<void> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 60) : "";
  const rating = Number(b.rating);
  const body = typeof b.body === "string" ? b.body.trim().slice(0, 1000) : "";
  const bad: string[] = [];
  if (name.length < 2) bad.push("name");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) bad.push("rating");
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    const p = await tx.query("SELECT published FROM tenant_profiles");
    if (!p.rows[0] || !p.rows[0].published) throw new AppError(404, "not_found");
    await tx.query("INSERT INTO reviews (id, tenant_id, customer_name, rating, body) VALUES ($1, $2, $3, $4, $5)", [randomUUID(), tenantId, name, rating, body]);
  });
}
