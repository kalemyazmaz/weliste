import { randomUUID } from "node:crypto";
import { Db, withTenant } from "./db";
import { AppError } from "./errors";
import { audit, getTenant } from "./service";
import { syncBookingListing } from "./booking-listing";
import { DEFAULT_CLOSE_MIN, DEFAULT_OPEN_MIN } from "./appointments";
import { isVenueMenu } from "./venue-catalog";

// İşletme ayarları: hizmetler, personel ve profil. Tüm sorgular kiracı bağlamında çalışır (RLS).

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ---------- Hizmetler ----------
export interface ServiceRow { id: string; name: string; priceTl: number; durationMin: number; guestCount: number | null; menu: string | null }

// Düğün salonu hizmetinde kişi sayısı ve menü zorunludur; diğer sektörlerde bu alanlar kullanılmaz.
function venueFields(sector: string | null | undefined, b: Record<string, unknown>, bad: string[]): { guestCount: number | null; menu: string | null } {
  if (sector !== "dugun-salonu") return { guestCount: null, menu: null };
  const guests = Number(b.guestCount);
  if (!Number.isInteger(guests) || guests < 1 || guests > 5000) bad.push("guestCount");
  if (!isVenueMenu(b.menu)) bad.push("menu");
  return { guestCount: Number.isInteger(guests) ? guests : null, menu: isVenueMenu(b.menu) ? b.menu : null };
}

export async function listServices(db: Db, tenantId: string): Promise<ServiceRow[]> {
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("SELECT id, name, price_tl::text AS price_tl, duration_min, guest_count, menu FROM services ORDER BY created_at");
    return r.rows.map((x) => ({ id: String(x.id), name: String(x.name), priceTl: Number(x.price_tl), durationMin: Number(x.duration_min), guestCount: x.guest_count === null ? null : Number(x.guest_count), menu: x.menu ? String(x.menu) : null }));
  });
}

export async function addService(db: Db, tenantId: string, raw: unknown, actor?: string): Promise<void> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = clean(b.name, 120);
  const price = Number(b.priceTl ?? 0);
  const duration = Number(b.durationMin ?? 60);
  const bad: string[] = [];
  if (name.length < 2) bad.push("name");
  if (!Number.isFinite(price) || price < 0) bad.push("priceTl");
  if (!Number.isInteger(duration) || duration < 1 || duration > 720) bad.push("durationMin");
  const tenant = await getTenant(db, tenantId);
  const venue = venueFields(tenant?.sector, b, bad);
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    const id = randomUUID();
    await tx.query("INSERT INTO services (id, tenant_id, name, price_tl, duration_min, guest_count, menu) VALUES ($1, $2, $3, $4, $5, $6, $7)", [id, tenantId, name, price, duration, venue.guestCount, venue.menu]);
    await audit(tx, tenantId, actor, "service.add", id, { name });
  });
}

export async function updateService(db: Db, tenantId: string, id: string, raw: unknown, actor?: string): Promise<void> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = clean(b.name, 120);
  const price = Number(b.priceTl ?? 0);
  const duration = Number(b.durationMin ?? 60);
  const bad: string[] = [];
  if (name.length < 2) bad.push("name");
  if (!Number.isFinite(price) || price < 0) bad.push("priceTl");
  if (!Number.isInteger(duration) || duration < 1 || duration > 720) bad.push("durationMin");
  const tenant = await getTenant(db, tenantId);
  const venue = venueFields(tenant?.sector, b, bad);
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("UPDATE services SET name = $2, price_tl = $3, duration_min = $4, guest_count = $5, menu = $6 WHERE id = $1 RETURNING id", [id, name, price, duration, venue.guestCount, venue.menu]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "service.update", id, { name });
  });
}

export async function deleteService(db: Db, tenantId: string, id: string, actor?: string): Promise<void> {
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("DELETE FROM services WHERE id = $1 RETURNING name", [id]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "service.delete", id, { name: r.rows[0].name });
  });
}

// ---------- Personel ----------
export interface StaffRow { id: string; name: string; role: string; userId: string | null; active: boolean }

export async function listStaff(db: Db, tenantId: string): Promise<StaffRow[]> {
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("SELECT id, name, role, user_id, active FROM staff ORDER BY created_at");
    return r.rows.map((x) => ({ id: String(x.id), name: String(x.name), role: String(x.role), userId: x.user_id ? String(x.user_id) : null, active: Boolean(x.active) }));
  });
}

export async function addStaff(db: Db, tenantId: string, raw: unknown, actor?: string): Promise<void> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = clean(b.name, 120);
  const role = clean(b.role, 80);
  if (name.length < 2) throw new AppError(422, "validation", ["name"]);
  await withTenant(db, tenantId, async (tx) => {
    const id = randomUUID();
    await tx.query("INSERT INTO staff (id, tenant_id, name, role) VALUES ($1, $2, $3, $4)", [id, tenantId, name, role]);
    await audit(tx, tenantId, actor, "staff.add", id, { name });
  });
}

export async function updateStaff(db: Db, tenantId: string, id: string, raw: unknown, actor?: string): Promise<void> {
  const b = (raw ?? {}) as Record<string, unknown>;
  // Yalnızca gönderilen alanlar değişir (ad, unvan, aktiflik, hesap bağlantısı).
  const name = "name" in b ? clean(b.name, 120) : null;
  if (name !== null && name.length < 2) throw new AppError(422, "validation", ["name"]);
  const role = "role" in b ? clean(b.role, 80) : null;
  const active = "active" in b ? (b.active === true || b.active === "true") : null;
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query(
      "UPDATE staff SET name = COALESCE($2, name), role = COALESCE($3, role), active = COALESCE($4, active) WHERE id = $1 RETURNING id, name",
      [id, name, role, active],
    );
    if (!r.rows.length) throw new AppError(404, "not_found");
    // Hesap bağlantısı yalnızca "userId" gönderildiğinde değişir. Bağlı kullanıcı işletmenin üyesi olmalıdır.
    if ("userId" in b) {
      const userId = typeof b.userId === "string" && b.userId ? b.userId : null;
      if (userId) {
        const m = await tx.query("SELECT 1 FROM memberships WHERE tenant_id = $1 AND user_id = $2", [tenantId, userId]);
        if (!m.rows.length) throw new AppError(422, "validation", ["userId"]);
        const taken = await tx.query("SELECT 1 FROM staff WHERE user_id = $1 AND id <> $2", [userId, id]);
        if (taken.rows.length) throw new AppError(409, "user_already_linked");
      }
      await tx.query("UPDATE staff SET user_id = $2 WHERE id = $1", [id, userId]);
    }
    await audit(tx, tenantId, actor, "staff.update", id, { name: String(r.rows[0].name) });
  });
}

export async function deleteStaff(db: Db, tenantId: string, id: string, actor?: string): Promise<void> {
  await withTenant(db, tenantId, async (tx) => {
    // Gelecekteki onaylı randevusu olan personel silinemez; aksi halde randevular sahipsiz kalır.
    const upcoming = await tx.query(
      "SELECT 1 FROM appointments WHERE staff_id = $1 AND status = 'onaylandi' AND ends_at > now() LIMIT 1",
      [id],
    );
    if (upcoming.rows.length) throw new AppError(409, "staff_has_appointments");
    const r = await tx.query("DELETE FROM staff WHERE id = $1 RETURNING name", [id]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "staff.delete", id, { name: r.rows[0].name });
  });
}

// ---------- Profil ve yayın ----------
export type DayHours = { open: number; close: number } | null; // null = kapalı gün
export interface ProfileRow { description: string; phone: string; email: string; address: string; published: boolean; opensMin: number; closesMin: number; dayHours: DayHours[] }

const defaultDays = (): DayHours[] => Array.from({ length: 7 }, () => ({ open: DEFAULT_OPEN_MIN, close: DEFAULT_CLOSE_MIN }));
const EMPTY_PROFILE: ProfileRow = { description: "", phone: "", email: "", address: "", published: false, opensMin: DEFAULT_OPEN_MIN, closesMin: DEFAULT_CLOSE_MIN, dayHours: defaultDays() };

// "HH:MM" -> dakika. Yalnızca 30 dakikalık adımlar kabul edilir.
function clock(v: unknown, fallback: number): number | null {
  if (v === undefined || v === null || v === "") return fallback;
  const m = /^(\d{2}):(\d{2})$/.exec(String(v));
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  if (Number(m[1]) > 23 || Number(m[2]) > 59 || min % 30 !== 0) return null;
  return min;
}

const minToClock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export { minToClock };

export async function getProfile(db: Db, tenantId: string): Promise<ProfileRow> {
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("SELECT description, phone, email, address, published, opens_min, closes_min, day_hours FROM tenant_profiles");
    const x = r.rows[0];
    if (!x) return EMPTY_PROFILE;
    const stored = x.day_hours as Array<{ open: number; close: number } | null> | null;
    const dayHours: DayHours[] = Array.isArray(stored) && stored.length === 7
      ? stored.map((d) => (d ? { open: Number(d.open), close: Number(d.close) } : null))
      : Array.from({ length: 7 }, () => ({ open: Number(x.opens_min), close: Number(x.closes_min) }));
    return {
      description: String(x.description), phone: String(x.phone), email: String(x.email),
      address: String(x.address), published: Boolean(x.published),
      opensMin: Number(x.opens_min), closesMin: Number(x.closes_min), dayHours,
    };
  });
}

// Gün listesi: 7 eleman (0 = Pazar). Her eleman {opensAt, closesAt} ya da kapalı gün için {on: false}.
// Liste gönderilmediyse null döner ve mevcut gün ayarları korunur.
function parseDays(raw: unknown): DayHours[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length !== 7) throw new AppError(422, "validation", ["dayHours"]);
  const bad: string[] = [];
  const days = raw.map((d) => {
    const x = (d ?? {}) as Record<string, unknown>;
    if (x.on === false || x.on === "false") return null;
    const open = clock(x.opensAt, DEFAULT_OPEN_MIN);
    const close = clock(x.closesAt, DEFAULT_CLOSE_MIN);
    if (open === null || close === null || close <= open || close > 1440) { bad.push("dayHours"); return null; }
    return { open, close };
  });
  if (bad.length) throw new AppError(422, "validation", ["dayHours"]);
  return days;
}

export function parseProfile(raw: unknown): ProfileRow & { dayHoursInput: DayHours[] | null } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const email = clean(b.email, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(422, "validation", ["email"]);
  const opensMin = clock(b.opensAt, DEFAULT_OPEN_MIN);
  const closesMin = clock(b.closesAt, DEFAULT_CLOSE_MIN);
  const hours: string[] = [];
  if (opensMin === null) hours.push("opensAt");
  if (closesMin === null) hours.push("closesAt");
  if (opensMin !== null && closesMin !== null && (closesMin <= opensMin || closesMin > 1440)) hours.push("closesAt");
  if (hours.length) throw new AppError(422, "validation", hours);
  return {
    description: clean(b.description, 2000),
    phone: clean(b.phone, 30),
    email,
    address: clean(b.address, 300),
    published: b.published === true || b.published === "true",
    opensMin: opensMin!,
    closesMin: closesMin!,
    dayHours: [],
    dayHoursInput: parseDays(b.dayHours),
  };
}

export async function saveProfile(db: Db, tenantId: string, raw: unknown, actor?: string): Promise<void> {
  const p = parseProfile(raw);
  const tenant = await getTenant(db, tenantId);
  if (!tenant) throw new AppError(404, "not_found");
  await withTenant(db, tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO tenant_profiles (tenant_id, description, phone, email, address, published, opens_min, closes_min, day_hours, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
       ON CONFLICT (tenant_id) DO UPDATE SET description = EXCLUDED.description, phone = EXCLUDED.phone, email = EXCLUDED.email,
         address = EXCLUDED.address, published = EXCLUDED.published, opens_min = EXCLUDED.opens_min,
         closes_min = EXCLUDED.closes_min,
         day_hours = COALESCE(EXCLUDED.day_hours, tenant_profiles.day_hours), updated_at = now()`,
      [tenantId, p.description, p.phone, p.email, p.address, p.published, p.opensMin, p.closesMin, p.dayHoursInput ? JSON.stringify(p.dayHoursInput) : null],
    );
    await audit(tx, tenantId, actor, "profile.save", tenantId, { published: p.published });
  });
  if (tenant.sector) {
    await syncBookingListing(db, tenantId, tenant.sector, tenant.name, tenant.city, p.description, p.published);
  }
}
