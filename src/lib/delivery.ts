import { randomBytes, randomUUID } from "node:crypto";
import { Db, withTenant } from "./db";
import { AppError } from "./errors";
import { audit, getTenant } from "./service";
import { moduleAppliesTo } from "./module-catalog";
import { getModules } from "./modules";

// Fotoğraf teslim ve seçimi. Oturum işletme tarafından açılır; müşteri tokenli linkle hesapsız seçer.
const IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_PHOTO_CHARS = 600000; // önizleme boyutu (yerel geliştirme); orijinal dosyalar depolama aşamasında
const MAX_PHOTOS_PER_SESSION = 200;
const DEFAULT_DAYS = 30;

export interface DeliveryPhoto { id: string; data: string; selected: boolean }
export interface DeliverySummary {
  id: string; title: string; clientName: string; token: string; photoLimit: number;
  expiresAt: string; closed: boolean; submittedAt: string | null; photoCount: number; selectedCount: number;
}

// Modül açık ve sektör doğru değilse uç nokta yok sayılır.
export async function requireDeliveryModule(db: Db, tenantId: string): Promise<void> {
  const tenant = await getTenant(db, tenantId);
  if (!tenant || !moduleAppliesTo("photo_delivery", tenant.sector)) throw new AppError(404, "not_found");
  const modules = await getModules(db, tenantId);
  if (!modules.photo_delivery) throw new AppError(404, "not_found");
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number | null {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

export async function listDeliverySessions(db: Db, tenantId: string): Promise<DeliverySummary[]> {
  await requireDeliveryModule(db, tenantId);
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<Record<string, unknown>>(
      `SELECT s.id, s.title, s.client_name, s.token, s.photo_limit, s.expires_at, s.closed, s.submitted_at,
              (SELECT count(*)::int FROM delivery_photos p WHERE p.session_id = s.id) AS photo_count,
              (SELECT count(*)::int FROM delivery_photos p WHERE p.session_id = s.id AND p.selected) AS selected_count
       FROM delivery_sessions s ORDER BY s.created_at DESC`,
    );
    return r.rows.map((x) => ({
      id: String(x.id), title: String(x.title), clientName: String(x.client_name), token: String(x.token),
      photoLimit: Number(x.photo_limit), expiresAt: new Date(x.expires_at as string).toISOString(), closed: Boolean(x.closed),
      submittedAt: x.submitted_at ? new Date(x.submitted_at as string).toISOString() : null,
      photoCount: Number(x.photo_count), selectedCount: Number(x.selected_count),
    }));
  });
}

export async function createDeliverySession(db: Db, tenantId: string, raw: unknown, actor?: string): Promise<{ id: string; token: string }> {
  await requireDeliveryModule(db, tenantId);
  const b = (raw ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 120) : "";
  const clientName = typeof b.clientName === "string" ? b.clientName.trim().slice(0, 120) : "";
  const photoLimit = clampInt(b.photoLimit, 1, 200, 10);
  const days = clampInt(b.days, 1, 365, DEFAULT_DAYS);
  const bad: string[] = [];
  if (title.length < 2) bad.push("title");
  if (photoLimit === null) bad.push("photoLimit");
  if (days === null) bad.push("days");
  if (bad.length) throw new AppError(422, "validation", bad);
  const id = randomUUID();
  const token = randomBytes(24).toString("base64url");
  await withTenant(db, tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO delivery_sessions (id, tenant_id, title, client_name, token, photo_limit, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' days')::interval)`,
      [id, tenantId, title, clientName, token, photoLimit, String(days)],
    );
    await audit(tx, tenantId, actor, "delivery.create", id, { title });
  });
  return { id, token };
}

// Oturum ayarları: başlık, müşteri, seçim limiti, süre (bugünden itibaren gün) ve kapatma.
export async function updateDeliverySession(db: Db, tenantId: string, id: string, raw: unknown, actor?: string): Promise<void> {
  await requireDeliveryModule(db, tenantId);
  const b = (raw ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 120) : undefined;
  const clientName = typeof b.clientName === "string" ? b.clientName.trim().slice(0, 120) : undefined;
  const photoLimit = "photoLimit" in b ? clampInt(b.photoLimit, 1, 200, 10) : undefined;
  const days = "days" in b ? clampInt(b.days, 1, 365, DEFAULT_DAYS) : undefined;
  const closed = typeof b.closed === "boolean" ? b.closed : undefined;
  const bad: string[] = [];
  if (title !== undefined && title.length < 2) bad.push("title");
  if (photoLimit === null) bad.push("photoLimit");
  if (days === null) bad.push("days");
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query(
      `UPDATE delivery_sessions SET
         title = COALESCE($2, title), client_name = COALESCE($3, client_name), photo_limit = COALESCE($4, photo_limit),
         expires_at = CASE WHEN $5::int IS NULL THEN expires_at ELSE now() + ($5::int || ' days')::interval END,
         closed = COALESCE($6, closed)
       WHERE id = $1 RETURNING id`,
      [id, title ?? null, clientName ?? null, photoLimit ?? null, days ?? null, closed ?? null],
    );
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "delivery.update", id, { closed: closed ?? null });
  });
}

export async function deleteDeliverySession(db: Db, tenantId: string, id: string, actor?: string): Promise<void> {
  await requireDeliveryModule(db, tenantId);
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("DELETE FROM delivery_sessions WHERE id = $1 RETURNING id", [id]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "delivery.delete", id, {});
  });
}

export async function getDeliverySession(db: Db, tenantId: string, id: string): Promise<{ session: DeliverySummary; photos: DeliveryPhoto[] }> {
  const all = await listDeliverySessions(db, tenantId);
  const session = all.find((s) => s.id === id);
  if (!session) throw new AppError(404, "not_found");
  const photos = await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<{ id: string; data: string; selected: boolean }>("SELECT id, data, selected FROM delivery_photos WHERE session_id = $1 ORDER BY created_at", [id]);
    return r.rows.map((x) => ({ id: String(x.id), data: String(x.data), selected: Boolean(x.selected) }));
  });
  return { session, photos };
}

export async function addDeliveryPhoto(db: Db, tenantId: string, sessionId: string, raw: unknown, actor?: string): Promise<string> {
  await requireDeliveryModule(db, tenantId);
  const data = (raw as Record<string, unknown> | null)?.image;
  if (typeof data !== "string" || data.length > MAX_PHOTO_CHARS || !IMG.test(data)) throw new AppError(422, "validation", ["image"]);
  const id = randomUUID();
  await withTenant(db, tenantId, async (tx) => {
    const s = await tx.query<{ closed: boolean }>("SELECT closed FROM delivery_sessions WHERE id = $1", [sessionId]);
    if (!s.rows.length) throw new AppError(404, "not_found");
    if (s.rows[0].closed) throw new AppError(409, "closed");
    const n = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM delivery_photos WHERE session_id = $1", [sessionId]);
    if (Number(n.rows[0].n) >= MAX_PHOTOS_PER_SESSION) throw new AppError(422, "validation", ["gallery"]);
    await tx.query("INSERT INTO delivery_photos (id, tenant_id, session_id, data) VALUES ($1, $2, $3, $4)", [id, tenantId, sessionId, data]);
    await audit(tx, tenantId, actor, "delivery.photo.add", sessionId, {});
  });
  return id;
}

export async function deleteDeliveryPhoto(db: Db, tenantId: string, photoId: string, actor?: string): Promise<void> {
  await requireDeliveryModule(db, tenantId);
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("DELETE FROM delivery_photos WHERE id = $1 RETURNING id", [photoId]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "delivery.photo.delete", photoId, {});
  });
}

// Müşterinin görünümü. Token eşleşmezse ya da oturum yoksa 404 döner.
export async function getPublicDelivery(db: Db, tenantId: string, token: string) {
  await requireDeliveryModule(db, tenantId);
  return withTenant(db, tenantId, async (tx) => {
    const s = await tx.query<Record<string, unknown>>("SELECT id, title, client_name, photo_limit, expires_at, closed, submitted_at FROM delivery_sessions WHERE token = $1", [token]);
    const row = s.rows[0];
    if (!row) throw new AppError(404, "not_found");
    const photos = await tx.query<{ id: string; data: string; selected: boolean }>("SELECT id, data, selected FROM delivery_photos WHERE session_id = $1 ORDER BY created_at", [row.id]);
    const expired = new Date(row.expires_at as string).getTime() < Date.now();
    return {
      title: String(row.title),
      clientName: String(row.client_name),
      photoLimit: Number(row.photo_limit),
      expiresAt: new Date(row.expires_at as string).toISOString(),
      expired,
      closed: Boolean(row.closed),
      submitted: row.submitted_at !== null,
      photos: photos.rows.map((p) => ({ id: String(p.id), data: String(p.data), selected: Boolean(p.selected) })),
    };
  });
}

// Müşteri seçimi: tek seferlik. Seçim limiti ve süre kontrol edilir; seçimler kilitlenir.
export async function submitDeliverySelection(db: Db, tenantId: string, token: string, raw: unknown): Promise<void> {
  await requireDeliveryModule(db, tenantId);
  const b = (raw ?? {}) as Record<string, unknown>;
  const ids = Array.isArray(b.photoIds) ? b.photoIds.filter((x): x is string => typeof x === "string") : null;
  if (!ids || ids.length === 0 || new Set(ids).size !== ids.length) throw new AppError(422, "validation", ["photoIds"]);
  await withTenant(db, tenantId, async (tx) => {
    const s = await tx.query<Record<string, unknown>>("SELECT id, photo_limit, expires_at, closed, submitted_at FROM delivery_sessions WHERE token = $1 FOR UPDATE", [token]);
    const row = s.rows[0];
    if (!row) throw new AppError(404, "not_found");
    if (row.submitted_at) throw new AppError(409, "already_submitted");
    if (row.closed) throw new AppError(409, "closed");
    if (new Date(row.expires_at as string).getTime() < Date.now()) throw new AppError(410, "expired");
    if (ids.length > Number(row.photo_limit)) throw new AppError(422, "validation", ["photoIds"]);
    const valid = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM delivery_photos WHERE session_id = $1 AND id = ANY($2::text[])", [row.id, ids]);
    if (Number(valid.rows[0].n) !== ids.length) throw new AppError(422, "validation", ["photoIds"]);
    await tx.query("UPDATE delivery_photos SET selected = (id = ANY($2::text[])) WHERE session_id = $1", [row.id, ids]);
    await tx.query("UPDATE delivery_sessions SET submitted_at = now() WHERE id = $1", [row.id]);
    await audit(tx, tenantId, undefined, "delivery.selection", String(row.id), { count: ids.length });
  });
}
