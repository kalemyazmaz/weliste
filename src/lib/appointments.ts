import { randomUUID } from "node:crypto";
import { Db, Queryable, withTenant } from "./db";
import { AppError } from "./errors";
import { audit, normalizePhone } from "./service";
import { queueReminders } from "./reminders";
import { ALL_SCOPE, Scope, scopeArgs } from "./scope";
import { recordAppointmentIncome } from "./ledger";

// Genel sektör randevusu. Saat dilimi Türkiye (UTC+3, yaz saati uygulaması yok).
// Çalışma saatleri ve adım aralığı şimdilik sabit; kiracı bazlı ayar sonraki sürümde.

export const TZ = "+03:00";
// Varsayılan çalışma saatleri (dakika). İşletme kendi saatlerini ayarlar (tenant_profiles).
export const DEFAULT_OPEN_MIN = 9 * 60; // 09:00
export const DEFAULT_CLOSE_MIN = 20 * 60; // 20:00
export const SLOT_STEP_MIN = 30;

type Row = Record<string, unknown>;

export interface AppointmentInput {
  serviceId: string;
  staffId: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  customerName: string;
  customerPhone: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isRealDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
}

function timeToMin(t: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Yerel tarih ve dakika -> mutlak an (ms).
function instant(date: string, min: number): number {
  return new Date(`${date}T${hhmm(min)}:00${TZ}`).getTime();
}

function dayBounds(date: string): { start: number; end: number } {
  const start = new Date(`${date}T00:00:00${TZ}`).getTime();
  return { start, end: start + DAY_MS };
}

export function parseAppointmentInput(raw: unknown): AppointmentInput {
  const b = (raw ?? {}) as Record<string, unknown>;
  const serviceId = typeof b.serviceId === "string" ? b.serviceId.trim().slice(0, 80) : "";
  const staffId = typeof b.staffId === "string" && b.staffId.trim() ? b.staffId.trim().slice(0, 80) : null;
  const date = typeof b.date === "string" ? b.date : "";
  const time = typeof b.time === "string" ? b.time : "";
  const customerName = typeof b.customerName === "string" ? b.customerName.trim() : "";
  const customerPhone = normalizePhone(b.customerPhone);

  const bad: string[] = [];
  if (!serviceId) bad.push("serviceId");
  if (!isRealDate(date)) bad.push("date");
  const min = timeToMin(time);
  // Saat biçimi ve 30 dakikalık adım; çalışma saati aralığı işletmeye göre ayrıca denetlenir.
  if (min === null || min % SLOT_STEP_MIN !== 0) bad.push("time");
  if (customerName.length < 2 || customerName.length > 120) bad.push("customerName");
  if (!customerPhone) bad.push("customerPhone");
  if (bad.length) throw new AppError(422, "validation", bad);
  return { serviceId, staffId, date, time, customerName, customerPhone: customerPhone! };
}

interface ServiceRef { id: string; name: string; durationMin: number }
interface Busy { staffId: string | null; start: number; end: number }

export interface Hours { open: number; close: number }

// İşletmenin çalışma saatleri. Herkese açık uçlarda işletme yayında olmalıdır (yoksa 404).
// Yerel tarihin haftanın günü (0 = Pazar). Türkiye saati sabit +03:00 olduğundan öğlen anı kullanılır.
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00${TZ}`).getUTCDay();
}

// Tarihin çalışma saatleri. Kapalı günde null döner.
async function loadProfile(tx: Queryable, tenantId: string, requirePublished: boolean, date: string): Promise<Hours | null> {
  const r = await tx.query("SELECT published, opens_min, closes_min, day_hours FROM tenant_profiles WHERE tenant_id = $1", [tenantId]);
  const row = r.rows[0];
  if (requirePublished && (!row || !row.published)) throw new AppError(404, "not_found");
  const dayHours = row?.day_hours;
  if (Array.isArray(dayHours) && dayHours.length === 7) {
    const entry = dayHours[weekdayOf(date)];
    return entry ? { open: Number(entry.open), close: Number(entry.close) } : null;
  }
  return row
    ? { open: Number(row.opens_min), close: Number(row.closes_min) }
    : { open: DEFAULT_OPEN_MIN, close: DEFAULT_CLOSE_MIN };
}

async function loadService(tx: Queryable, id: string): Promise<ServiceRef> {
  const r = await tx.query("SELECT id, name, duration_min FROM services WHERE id = $1", [id]);
  const row = r.rows[0];
  if (!row) throw new AppError(422, "validation", ["serviceId"]);
  return { id: String(row.id), name: String(row.name), durationMin: Number(row.duration_min) };
}

// Aday personel: seçilen kişi, ya da tüm ekip. Ekip yoksa tek kapasiteli "atanmamış" kaynak.
async function candidateStaff(tx: Queryable, staffId: string | null): Promise<Array<string | null>> {
  if (staffId) {
    const r = await tx.query("SELECT 1 FROM staff WHERE id = $1 AND active", [staffId]);
    if (!r.rows.length) throw new AppError(422, "validation", ["staffId"]);
    return [staffId];
  }
  // Pasif personel randevu atamasında dikkate alınmaz.
  const r = await tx.query("SELECT id FROM staff WHERE active ORDER BY created_at");
  return r.rows.length ? r.rows.map((x) => String(x.id)) : [null];
}

async function dayBusy(tx: Queryable, date: string, excludeId?: string): Promise<Busy[]> {
  const { start, end } = dayBounds(date);
  const r = await tx.query(
    `SELECT id, staff_id, starts_at, ends_at FROM appointments
     WHERE status = 'onaylandi' AND starts_at < $2 AND ends_at > $1 AND ($3::text IS NULL OR id <> $3)`,
    [new Date(start).toISOString(), new Date(end).toISOString(), excludeId ?? null],
  );
  return r.rows.map((x) => ({
    staffId: x.staff_id ? String(x.staff_id) : null,
    start: new Date(x.starts_at as string).getTime(),
    end: new Date(x.ends_at as string).getTime(),
  }));
}

// İlk boş aday; hiçbiri boş değilse undefined.
function pickStaff(candidates: Array<string | null>, busy: Busy[], start: number, end: number): string | null | undefined {
  for (const c of candidates) {
    const clash = busy.some((b) => b.staffId === c && b.start < end && b.end > start);
    if (!clash) return c;
  }
  return undefined;
}

export interface Slot { time: string; available: boolean }

export async function getSlots(
  db: Db,
  tenantId: string,
  opts: { serviceId: string; date: string; staffId?: string | null; publicOnly: boolean },
): Promise<Slot[]> {
  if (!opts.serviceId) throw new AppError(422, "validation", ["serviceId"]);
  if (!isRealDate(opts.date)) throw new AppError(422, "validation", ["date"]);
  const staffId = opts.staffId ?? null;
  return withTenant(db, tenantId, async (tx) => {
    const hours = await loadProfile(tx, tenantId, opts.publicOnly, opts.date);
    if (!hours) return [];
    const svc = await loadService(tx, opts.serviceId);
    const candidates = await candidateStaff(tx, staffId);
    const busy = await dayBusy(tx, opts.date);
    const now = Date.now();
    const slots: Slot[] = [];
    for (let min = hours.open; min < hours.close; min += SLOT_STEP_MIN) {
      const start = instant(opts.date, min);
      const end = start + svc.durationMin * 60000;
      if (end > instant(opts.date, hours.close)) break;
      const free = start > now && pickStaff(candidates, busy, start, end) !== undefined;
      slots.push({ time: hhmm(min), available: free });
    }
    return slots;
  });
}

export interface CreatedAppointment { id: string; startsAt: string; endsAt: string; staffId: string | null }

// publicBooking: müşteri tarafından (oturumsuz) alınan randevu; yalnızca yayınlanmış işletmeler için.
// Kiracı bazlı kilit, aynı işletmedeki eşzamanlı isteklerin aynı slotu almasını engeller.
export async function createAppointment(
  db: Db,
  tenantId: string,
  raw: unknown,
  opts: { actor?: string; publicBooking: boolean; forceStaffId?: string },
): Promise<CreatedAppointment> {
  const input = parseAppointmentInput(raw);
  const min = timeToMin(input.time)!;
  return withTenant(db, tenantId, async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`appt:${tenantId}`]);
    const hours = await loadProfile(tx, tenantId, opts.publicBooking, input.date);
    if (!hours) throw new AppError(422, "validation", ["date"]);
    const svc = await loadService(tx, input.serviceId);
    const start = instant(input.date, min);
    const end = start + svc.durationMin * 60000;
    if (start <= Date.now()) throw new AppError(422, "validation", ["date", "time"]);
    if (min < hours.open || end > instant(input.date, hours.close)) throw new AppError(422, "validation", ["time"]);
    // Üye randevusu her zaman kendi personel kaydına yazılır.
    const candidates = await candidateStaff(tx, opts.forceStaffId ?? input.staffId);
    const busy = await dayBusy(tx, input.date);
    const picked = pickStaff(candidates, busy, start, end);
    if (picked === undefined) throw new AppError(409, "slot_taken");

    const id = randomUUID();
    const startsAt = new Date(start).toISOString();
    const endsAt = new Date(end).toISOString();
    await tx.query(
      `INSERT INTO appointments (id, tenant_id, service_id, service_name, staff_id, customer_name, customer_phone, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, tenantId, svc.id, svc.name, picked, input.customerName, input.customerPhone, startsAt, endsAt],
    );
    // Denetim kaydında müşteri adı ve telefonu tutulmaz; yalnızca işlemin özeti.
    await audit(tx, tenantId, opts.actor, "appointment.create", id, { service: svc.name, startsAt, staffId: picked });
    return { id, startsAt, endsAt, staffId: picked };
  }).then(async (created) => {
    await queueReminders(db, tenantId);
    return created;
  });
}

// Onaylı randevunun tarihini ve saatini değiştirir. Süre ve müşteri aynı kalır; eski hatırlatma
// kaldırılır ve yeni saate göre yeniden kuyruğa alınır.
export async function rescheduleAppointment(db: Db, tenantId: string, id: string, raw: unknown, actor?: string, scope: Scope = ALL_SCOPE): Promise<void> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const date = typeof b.date === "string" ? b.date : "";
  const time = typeof b.time === "string" ? b.time : "";
  const min = timeToMin(time);
  const bad: string[] = [];
  if (!isRealDate(date)) bad.push("date");
  if (min === null || min % SLOT_STEP_MIN !== 0) bad.push("time");
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`appt:${tenantId}`]);
    const cur = await tx.query("SELECT staff_id, starts_at, ends_at FROM appointments WHERE id = $1 AND status = 'onaylandi' AND ($2::boolean OR staff_id = $3)", [id, ...scopeArgs(scope)]);
    if (!cur.rows.length) throw new AppError(404, "not_found");
    const durationMs = new Date(cur.rows[0].ends_at as string).getTime() - new Date(cur.rows[0].starts_at as string).getTime();
    const hours = await loadProfile(tx, tenantId, false, date);
    if (!hours) throw new AppError(422, "validation", ["date"]);
    const start = instant(date, min!);
    const end = start + durationMs;
    if (start <= Date.now()) throw new AppError(422, "validation", ["date", "time"]);
    if (min! < hours.open || end > instant(date, hours.close)) throw new AppError(422, "validation", ["time"]);
    const currentStaff = cur.rows[0].staff_id ? String(cur.rows[0].staff_id) : null;
    const candidates = currentStaff ? [currentStaff] : await candidateStaff(tx, null);
    const busy = await dayBusy(tx, date, id);
    const picked = pickStaff(candidates, busy, start, end);
    if (picked === undefined) throw new AppError(409, "slot_taken");
    await tx.query(
      "UPDATE appointments SET starts_at = $2, ends_at = $3, staff_id = $4 WHERE id = $1",
      [id, new Date(start).toISOString(), new Date(end).toISOString(), picked],
    );
    await tx.query("DELETE FROM reminder_messages WHERE appointment_id = $1 AND status = 'queued'", [id]);
    await audit(tx, tenantId, actor, "appointment.reschedule", id, { startsAt: new Date(start).toISOString() });
  });
  await queueReminders(db, tenantId);
}

export type AppointmentOutcome = "tamamlandi" | "gelmedi";

// Onaylı bir randevunun sonucu: tamamlandı ya da gelmedi. İptal ayrı bir işlemdir.
export async function setAppointmentOutcome(db: Db, tenantId: string, id: string, outcome: unknown, actor?: string, scope: Scope = ALL_SCOPE): Promise<void> {
  if (outcome !== "tamamlandi" && outcome !== "gelmedi") throw new AppError(422, "validation", ["status"]);
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("UPDATE appointments SET status = $2 WHERE id = $1 AND status = 'onaylandi' AND ($3::boolean OR staff_id = $4) RETURNING id", [id, outcome, ...scopeArgs(scope)]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    // Tamamlanan randevunun hizmet bedeli kasaya gelir olarak yazılır.
    if (outcome === "tamamlandi") await recordAppointmentIncome(tx, tenantId, id);
    await audit(tx, tenantId, actor, `appointment.${outcome}`, id, {});
  });
}

export interface AppointmentRow {
  id: string;
  serviceName: string;
  staffId: string | null;
  customerName: string;
  customerPhone: string;
  startsAt: string;
  endsAt: string;
  status: "onaylandi" | "tamamlandi" | "gelmedi" | "iptal";
}

export async function listAppointments(db: Db, tenantId: string, date: string, scope: Scope = ALL_SCOPE): Promise<AppointmentRow[]> {
  if (!isRealDate(date)) throw new AppError(422, "validation", ["date"]);
  const { start, end } = dayBounds(date);
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<Row>(
      `SELECT id, service_name, staff_id, customer_name, customer_phone, starts_at, ends_at, status
       FROM appointments WHERE starts_at >= $1 AND starts_at < $2 AND ($3::boolean OR staff_id = $4) ORDER BY starts_at`,
      [new Date(start).toISOString(), new Date(end).toISOString(), ...scopeArgs(scope)],
    );
    return r.rows.map((x) => ({
      id: String(x.id),
      serviceName: String(x.service_name),
      staffId: x.staff_id ? String(x.staff_id) : null,
      customerName: String(x.customer_name),
      customerPhone: String(x.customer_phone),
      startsAt: new Date(x.starts_at as string).toISOString(),
      endsAt: new Date(x.ends_at as string).toISOString(),
      status: x.status as AppointmentRow["status"],
    }));
  });
}

export async function cancelAppointment(db: Db, tenantId: string, id: string, actor?: string, scope: Scope = ALL_SCOPE): Promise<void> {
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("UPDATE appointments SET status = 'iptal' WHERE id = $1 AND status = 'onaylandi' AND ($2::boolean OR staff_id = $3) RETURNING id", [id, ...scopeArgs(scope)]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "appointment.cancel", id, {});
  });
}
