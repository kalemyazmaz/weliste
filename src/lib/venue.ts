import { randomBytes, randomUUID } from "node:crypto";
import { Db, withTenant } from "./db";
import { AppError } from "./errors";
import { audit, getTenant } from "./service";
import { moduleAppliesTo, type ModuleKey } from "./module-catalog";
import { getModules } from "./modules";
import { nextReceiptNo } from "./ledger";
import type { Queryable } from "./db";

// Düğün salonu: gündüz / gece seansları ve teklif talepleri.
export type Slot = "gunduz" | "gece";
export const SLOTS: Slot[] = ["gunduz", "gece"];

export interface VenueHall { id: string; name: string; capacity: number | null; active: boolean }
export interface VenueSession {
  id: string; hallId: string | null; date: string; slot: Slot; coupleName: string; phone: string; guestCount: number | null;
  priceTl: number; depositTl: number; note: string; status: "aktif" | "iptal";
}
export interface VenueInquiry {
  id: string; name: string; phone: string; eventDate: string | null; guestCount: number | null; message: string;
  status: "yeni" | "teklif_verildi" | "kapandi"; createdAt: string;
}

export async function requireVenueModule(db: Db, tenantId: string, key: ModuleKey): Promise<void> {
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !moduleAppliesTo(key, tenant.sector)) throw new AppError(404, "not_found");
  const modules = await getModules(db, tenantId);
  if (!modules[key]) throw new AppError(404, "not_found");
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function validDate(v: unknown): string | null {
  if (typeof v !== "string" || !DATE.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}
function money(v: unknown, fallback = 0): number | null {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1e9 ? Math.round(n * 100) / 100 : null;
}
function count(v: unknown): number | null | undefined {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5000 ? n : undefined;
}
function phone(v: unknown): string | null {
  if (typeof v !== "string") return "";
  const p = v.replace(/[^\d+]/g, "");
  if (p === "") return "";
  return p.length >= 7 && p.length <= 20 ? p : null;
}

// Ay aralığındaki seanslar. from/to: YYYY-MM-DD (dahil).
// Salon yoksa ilk salon ("Ana salon") oluşturulur; eski seanslar bu salona bağlanır.
export async function ensureDefaultHall(tx: Queryable, tenantId: string): Promise<string> {
  const any = await tx.query<{ id: string }>("SELECT id FROM venue_halls ORDER BY created_at LIMIT 1");
  let firstId = any.rows[0]?.id;
  if (!firstId) {
    firstId = randomUUID();
    await tx.query("INSERT INTO venue_halls (id, tenant_id, name) VALUES ($1, $2, 'Ana salon')", [firstId, tenantId]);
  }
  // Salonsuz eski seanslar ilk salona bağlanır.
  await tx.query("UPDATE venue_sessions SET hall_id = $1 WHERE hall_id IS NULL", [firstId]);
  const active = await tx.query<{ id: string }>("SELECT id FROM venue_halls WHERE active ORDER BY created_at LIMIT 1");
  return active.rows[0]?.id ?? firstId;
}

export async function listVenueHalls(db: Db, tenantId: string): Promise<VenueHall[]> {
  await requireVenueModule(db, tenantId, "venue_calendar");
  return withTenant(db, tenantId, async (tx) => {
    await ensureDefaultHall(tx, tenantId);
    const r = await tx.query<Record<string, unknown>>("SELECT id, name, capacity, active FROM venue_halls ORDER BY created_at");
    return r.rows.map((x) => ({ id: String(x.id), name: String(x.name), capacity: x.capacity === null ? null : Number(x.capacity), active: Boolean(x.active) }));
  });
}

export async function saveVenueHall(db: Db, tenantId: string, id: string | null, raw: unknown, actor?: string): Promise<string> {
  await requireVenueModule(db, tenantId, "venue_calendar");
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : undefined;
  const cap = "capacity" in b ? count(b.capacity) : undefined;
  const active = typeof b.active === "boolean" ? b.active : undefined;
  const bad: string[] = [];
  if (id === null && (!name || name.length < 2)) bad.push("name");
  if (name !== undefined && name.length < 2) bad.push("name");
  if (cap === undefined && "capacity" in b) bad.push("capacity");
  if (bad.length) throw new AppError(422, "validation", bad);
  return withTenant(db, tenantId, async (tx) => {
    if (id === null) {
      await ensureDefaultHall(tx, tenantId); // önce varsayılan salon oluşsun ki eski seanslar ona bağlansın
      const newId = randomUUID();
      await tx.query("INSERT INTO venue_halls (id, tenant_id, name, capacity) VALUES ($1, $2, $3, $4)", [newId, tenantId, name, cap ?? null]);
      await audit(tx, tenantId, actor, "venue.hall.create", newId, { name });
      return newId;
    }
    const r = await tx.query("UPDATE venue_halls SET name = COALESCE($2, name), capacity = CASE WHEN $3 THEN $4 ELSE capacity END, active = COALESCE($5, active) WHERE id = $1 RETURNING id", [id, name ?? null, "capacity" in b, cap ?? null, active ?? null]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "venue.hall.update", id, {});
    return id;
  });
}

export async function listVenueSessions(db: Db, tenantId: string, from: string, to: string, hallId?: string | null): Promise<VenueSession[]> {
  await requireVenueModule(db, tenantId, "venue_calendar");
  const f = validDate(from), t = validDate(to);
  if (!f || !t) throw new AppError(422, "validation", ["range"]);
  return withTenant(db, tenantId, async (tx) => {
    await ensureDefaultHall(tx, tenantId);
    const r = await tx.query<Record<string, unknown>>(
      `SELECT id, hall_id, session_date::text AS d, slot, couple_name, phone, guest_count, price_tl::float8 AS price, deposit_tl::float8 AS deposit, note, status
       FROM venue_sessions WHERE session_date BETWEEN $1 AND $2 AND ($3::text IS NULL OR hall_id = $3) ORDER BY session_date, slot`,
      [f, t, hallId ?? null],
    );
    return r.rows.map((x) => ({
      id: String(x.id), hallId: x.hall_id ? String(x.hall_id) : null, date: String(x.d), slot: x.slot as Slot, coupleName: String(x.couple_name), phone: String(x.phone),
      guestCount: x.guest_count === null ? null : Number(x.guest_count), priceTl: Number(x.price), depositTl: Number(x.deposit),
      note: String(x.note), status: x.status as "aktif" | "iptal",
    }));
  });
}

async function resolveHall(tx: Queryable, tenantId: string, hallId: unknown): Promise<string> {
  if (typeof hallId === "string" && hallId) {
    const r = await tx.query<{ id: string }>("SELECT id FROM venue_halls WHERE id = $1 AND active", [hallId]);
    if (!r.rows[0]) throw new AppError(422, "validation", ["hallId"]);
    return r.rows[0].id;
  }
  return ensureDefaultHall(tx, tenantId);
}

function sessionFields(b: Record<string, unknown>, partial: boolean) {
  const bad: string[] = [];
  const out: Record<string, unknown> = {};
  if (!partial || "coupleName" in b) {
    const name = typeof b.coupleName === "string" ? b.coupleName.trim().slice(0, 120) : "";
    if (name.length < 2) bad.push("coupleName"); else out.coupleName = name;
  }
  if (!partial || "phone" in b) { const p = phone(b.phone); if (p === null) bad.push("phone"); else out.phone = p; }
  if (!partial || "guestCount" in b) { const g = count(b.guestCount); if (g === undefined) bad.push("guestCount"); else out.guestCount = g; }
  if (!partial || "priceTl" in b) { const p = money(b.priceTl, 0); if (p === null) bad.push("priceTl"); else out.priceTl = p; }
  if (!partial || "depositTl" in b) { const d = money(b.depositTl, 0); if (d === null) bad.push("depositTl"); else out.depositTl = d; }
  if (!partial || "note" in b) out.note = typeof b.note === "string" ? b.note.trim().slice(0, 1000) : "";
  if (out.priceTl !== undefined && out.depositTl !== undefined && Number(out.depositTl) > Number(out.priceTl) && Number(out.priceTl) > 0) bad.push("depositTl");
  if (bad.length) throw new AppError(422, "validation", bad);
  return out;
}

// Kapora kasa defterine bir gelir olarak yazılır (seans başına tek kayıt). Tutar değişirse güncellenir; sıfır olursa silinir.
async function syncDeposit(tx: Queryable, tenantId: string, sessionId: string, deposit: number, label: string): Promise<void> {
  const existing = await tx.query<{ id: string }>("SELECT id FROM ledger_entries WHERE venue_session_id = $1", [sessionId]);
  if (deposit <= 0) {
    if (existing.rows.length) await tx.query("DELETE FROM ledger_entries WHERE venue_session_id = $1", [sessionId]);
    return;
  }
  if (existing.rows.length) {
    await tx.query("UPDATE ledger_entries SET amount_tl = $2, description = $3 WHERE venue_session_id = $1", [sessionId, deposit, label]);
    return;
  }
  const receipt = await nextReceiptNo(tx, tenantId);
  await tx.query(
    `INSERT INTO ledger_entries (id, tenant_id, kind, category, description, amount_tl, method, venue_session_id, receipt_no)
     VALUES ($1, $2, 'gelir', 'Kapora', $3, $4, 'nakit', $5, $6)`,
    [randomUUID(), tenantId, label, deposit, sessionId, receipt],
  );
}

async function depositLabel(tx: Queryable, sessionId: string): Promise<{ deposit: number; label: string }> {
  const r = await tx.query<Record<string, unknown>>("SELECT couple_name, session_date::text AS d, slot, deposit_tl::float8 AS deposit FROM venue_sessions WHERE id = $1", [sessionId]);
  const x = r.rows[0];
  return { deposit: Number(x.deposit), label: `Kapora · ${String(x.couple_name)} · ${String(x.d)} ${x.slot === "gece" ? "gece" : "gündüz"}`.slice(0, 300) };
}

export async function createVenueSession(db: Db, tenantId: string, raw: unknown, actor?: string): Promise<string> {
  await requireVenueModule(db, tenantId, "venue_calendar");
  const b = (raw ?? {}) as Record<string, unknown>;
  const date = validDate(b.date);
  const slot = typeof b.slot === "string" && (SLOTS as string[]).includes(b.slot) ? (b.slot as Slot) : null;
  const bad: string[] = [];
  if (!date) bad.push("date");
  if (!slot) bad.push("slot");
  const f = sessionFields(b, false);
  const id = randomUUID();
  if (bad.length) throw new AppError(422, "validation", bad);
  try {
    await withTenant(db, tenantId, async (tx) => {
      const hallId = await resolveHall(tx, tenantId, b.hallId);
      await tx.query(
        `INSERT INTO venue_sessions (id, tenant_id, hall_id, session_date, slot, couple_name, phone, guest_count, price_tl, deposit_tl, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id, tenantId, hallId, date, slot, f.coupleName, f.phone, f.guestCount ?? null, f.priceTl, f.depositTl, f.note],
      );
      const d = await depositLabel(tx, id);
      await syncDeposit(tx, tenantId, id, d.deposit, d.label);
      await audit(tx, tenantId, actor, "venue.session.create", id, { date, slot });
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new AppError(409, "slot_taken");
    throw err;
  }
  return id;
}

export async function updateVenueSession(db: Db, tenantId: string, id: string, raw: unknown, actor?: string): Promise<void> {
  await requireVenueModule(db, tenantId, "venue_calendar");
  const b = (raw ?? {}) as Record<string, unknown>;
  const f = sessionFields(b, true);
  const status = b.status === "iptal" || b.status === "aktif" ? b.status : undefined;
  if (b.status !== undefined && status === undefined) throw new AppError(422, "validation", ["status"]);
  try {
    await withTenant(db, tenantId, async (tx) => {
      const r = await tx.query(
        `UPDATE venue_sessions SET
           couple_name = COALESCE($2, couple_name), phone = COALESCE($3, phone), guest_count = CASE WHEN $4 THEN $5 ELSE guest_count END,
           price_tl = COALESCE($6, price_tl), deposit_tl = COALESCE($7, deposit_tl), note = COALESCE($8, note), status = COALESCE($9, status)
         WHERE id = $1 RETURNING id`,
        [id, f.coupleName ?? null, f.phone ?? null, "guestCount" in f, f.guestCount ?? null, f.priceTl ?? null, f.depositTl ?? null, f.note ?? null, status ?? null],
      );
      if (!r.rows.length) throw new AppError(404, "not_found");
      const d = await depositLabel(tx, id);
      await syncDeposit(tx, tenantId, id, d.deposit, d.label); // iptalde kapora kaydı defterde kalır
      await audit(tx, tenantId, actor, "venue.session.update", id, { status: status ?? null });
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new AppError(409, "slot_taken");
    throw err;
  }
}

export async function listVenueInquiries(db: Db, tenantId: string): Promise<VenueInquiry[]> {
  await requireVenueModule(db, tenantId, "venue_inquiries");
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<Record<string, unknown>>("SELECT id, name, phone, event_date::text AS d, guest_count, message, status, created_at FROM venue_inquiries ORDER BY created_at DESC LIMIT 200");
    return r.rows.map((x) => ({
      id: String(x.id), name: String(x.name), phone: String(x.phone), eventDate: x.d ? String(x.d) : null,
      guestCount: x.guest_count === null ? null : Number(x.guest_count), message: String(x.message), status: x.status as VenueInquiry["status"],
      createdAt: new Date(x.created_at as string).toISOString(),
    }));
  });
}

export async function setVenueInquiryStatus(db: Db, tenantId: string, id: string, status: unknown, actor?: string): Promise<void> {
  await requireVenueModule(db, tenantId, "venue_inquiries");
  if (status !== "yeni" && status !== "teklif_verildi" && status !== "kapandi") throw new AppError(422, "validation", ["status"]);
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("UPDATE venue_inquiries SET status = $2 WHERE id = $1 RETURNING id", [id, status]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, `venue.inquiry.${status}`, id, {});
  });
}

// Müşterinin teklif talebi (oturumsuz). İşletme yayında değilse ya da sektör uygun değilse kabul edilmez.
export async function createPublicInquiry(db: Db, tenantId: string, raw: unknown): Promise<void> {
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !moduleAppliesTo("venue_inquiries", tenant.sector)) throw new AppError(404, "not_found");
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  const p = phone(b.phone);
  const eventDate = b.eventDate === undefined || b.eventDate === "" ? null : validDate(b.eventDate);
  const guests = count(b.guestCount);
  const message = typeof b.message === "string" ? b.message.trim().slice(0, 1000) : "";
  const bad: string[] = [];
  if (name.length < 2) bad.push("name");
  if (!p) bad.push("phone");
  if (eventDate === null && b.eventDate) bad.push("eventDate");
  if (guests === undefined) bad.push("guestCount");
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    const pr = await tx.query("SELECT published FROM tenant_profiles");
    if (!pr.rows[0] || !pr.rows[0].published) throw new AppError(404, "not_found");
    await tx.query(
      "INSERT INTO venue_inquiries (id, tenant_id, name, phone, event_date, guest_count, message) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [randomUUID(), tenantId, name, p, eventDate, guests ?? null, message],
    );
  });
}

// ---------- Tedarikçiler ----------
export const SUPPLIER_CATEGORIES = ["muzik", "fotograf", "cicek", "yemek", "susleme", "diger"] as const;
export interface VenueSupplier { id: string; name: string; category: string; phone: string; costTl: number; note: string }

export async function listVenueSuppliers(db: Db, tenantId: string): Promise<VenueSupplier[]> {
  await requireVenueModule(db, tenantId, "venue_suppliers");
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<Record<string, unknown>>("SELECT id, name, category, phone, cost_tl::float8 AS cost, note FROM venue_suppliers ORDER BY name");
    return r.rows.map((x) => ({ id: String(x.id), name: String(x.name), category: String(x.category), phone: String(x.phone), costTl: Number(x.cost), note: String(x.note) }));
  });
}

export async function saveVenueSupplier(db: Db, tenantId: string, id: string | null, raw: unknown, actor?: string): Promise<void> {
  await requireVenueModule(db, tenantId, "venue_suppliers");
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : undefined;
  const category = typeof b.category === "string" && (SUPPLIER_CATEGORIES as readonly string[]).includes(b.category) ? b.category : undefined;
  const cost = "costTl" in b ? money(b.costTl, 0) : undefined;
  const p = "phone" in b ? phone(b.phone) : undefined;
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 500) : undefined;
  const bad: string[] = [];
  if (id === null && (!name || name.length < 2)) bad.push("name");
  if (name !== undefined && name.length < 2) bad.push("name");
  if ("category" in b && category === undefined) bad.push("category");
  if (cost === null) bad.push("costTl");
  if (p === null) bad.push("phone");
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    if (id === null) {
      const newId = randomUUID();
      await tx.query("INSERT INTO venue_suppliers (id, tenant_id, name, category, phone, cost_tl, note) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [newId, tenantId, name, category ?? "diger", p ?? "", cost ?? 0, note ?? ""]);
      await audit(tx, tenantId, actor, "venue.supplier.create", newId, { name });
      return;
    }
    const r = await tx.query("UPDATE venue_suppliers SET name = COALESCE($2, name), category = COALESCE($3, category), phone = COALESCE($4, phone), cost_tl = COALESCE($5, cost_tl), note = COALESCE($6, note) WHERE id = $1 RETURNING id",
      [id, name ?? null, category ?? null, p ?? null, cost ?? null, note ?? null]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "venue.supplier.update", id, {});
  });
}

export async function deleteVenueSupplier(db: Db, tenantId: string, id: string, actor?: string): Promise<void> {
  await requireVenueModule(db, tenantId, "venue_suppliers");
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("DELETE FROM venue_suppliers WHERE id = $1 RETURNING id", [id]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "venue.supplier.delete", id, {});
  });
}

// ---------- Paylaşım linkleri (müsaitlik, kimlik bilgisi yok) ----------
export interface VenueShareLink { id: string; label: string; token: string; expiresAt: string; revoked: boolean; expired: boolean }

export async function listVenueShareLinks(db: Db, tenantId: string): Promise<VenueShareLink[]> {
  await requireVenueModule(db, tenantId, "venue_share");
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<Record<string, unknown>>("SELECT id, label, token, expires_at, revoked FROM venue_share_links ORDER BY created_at DESC LIMIT 50");
    return r.rows.map((x) => {
      const exp = new Date(x.expires_at as string);
      return { id: String(x.id), label: String(x.label), token: String(x.token), expiresAt: exp.toISOString(), revoked: Boolean(x.revoked), expired: exp.getTime() < Date.now() };
    });
  });
}

export async function createVenueShareLink(db: Db, tenantId: string, raw: unknown, actor?: string): Promise<string> {
  await requireVenueModule(db, tenantId, "venue_share");
  const b = (raw ?? {}) as Record<string, unknown>;
  const label = typeof b.label === "string" ? b.label.trim().slice(0, 120) : "";
  const days = b.days === undefined ? 60 : Number(b.days);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new AppError(422, "validation", ["days"]);
  const id = randomUUID();
  const token = randomBytes(24).toString("base64url");
  await withTenant(db, tenantId, async (tx) => {
    await tx.query("INSERT INTO venue_share_links (id, tenant_id, label, token, expires_at) VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval)", [id, tenantId, label, token, String(days)]);
    await audit(tx, tenantId, actor, "venue.share.create", id, { days });
  });
  return token;
}

export async function revokeVenueShareLink(db: Db, tenantId: string, id: string, actor?: string): Promise<void> {
  await requireVenueModule(db, tenantId, "venue_share");
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("UPDATE venue_share_links SET revoked = true WHERE id = $1 RETURNING id", [id]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "venue.share.revoke", id, {});
  });
}

// Paylaşılan müsaitlik: salon ve seans durumu (dolu / boş). Kişi adı, telefon ve fiyat içermez.
export async function getSharedAvailability(db: Db, tenantId: string, token: string, from: string, to: string) {
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !moduleAppliesTo("venue_share", tenant.sector)) throw new AppError(404, "not_found");
  if (!(await getModules(db, tenantId)).venue_share) throw new AppError(404, "not_found");
  const f = validDate(from), t = validDate(to);
  if (!f || !t) throw new AppError(422, "validation", ["range"]);
  return withTenant(db, tenantId, async (tx) => {
    const l = await tx.query<Record<string, unknown>>("SELECT expires_at, revoked FROM venue_share_links WHERE token = $1", [token]);
    const link = l.rows[0];
    if (!link || link.revoked || new Date(link.expires_at as string).getTime() < Date.now()) throw new AppError(404, "not_found");
    const halls = await tx.query<{ id: string; name: string }>("SELECT id, name FROM venue_halls WHERE active ORDER BY created_at");
    const sess = await tx.query<{ hall_id: string | null; d: string; slot: string }>(
      "SELECT hall_id, session_date::text AS d, slot FROM venue_sessions WHERE status = 'aktif' AND session_date BETWEEN $1 AND $2", [f, t]);
    return {
      halls: halls.rows.map((h) => ({ id: String(h.id), name: String(h.name) })),
      taken: sess.rows.map((s) => ({ hallId: s.hall_id ? String(s.hall_id) : null, date: String(s.d), slot: s.slot as Slot })),
    };
  });
}
