import { randomUUID } from "node:crypto";
import { Db, withTenant, Queryable } from "./db";
import { AppError } from "./errors";
import { audit } from "./service";
import { requireVenueModule } from "./venue";
import type { ModuleKey } from "./module-catalog";

// Organizasyon: etkinlik projeleri, ekip ataması, görevler ve bütçe giderleri.
import { EVENT_STATUSES, COST_CATEGORIES, type EventStatus } from "./org-catalog";
export { EVENT_STATUSES, COST_CATEGORIES };
export type { EventStatus };

export interface OrgEventRow {
  id: string; title: string; clientName: string; clientPhone: string; eventDate: string; location: string;
  guestCount: number | null; budgetTl: number; status: EventStatus; note: string;
  taskTotal: number; taskDone: number; costTotal: number; costPaid: number; staffIds: string[];
}
export interface OrgTask { id: string; title: string; dueDate: string | null; done: boolean; assigneeId: string | null }
export interface OrgCost { id: string; name: string; category: string; amountTl: number; paid: boolean }

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
function phone(v: unknown): string | null {
  if (typeof v !== "string") return "";
  const p = v.replace(/[^\d+]/g, "");
  if (p === "") return "";
  return p.length >= 7 && p.length <= 20 ? p : null;
}
async function requireOrg(db: Db, tenantId: string, key: ModuleKey) {
  // Düğün salonu yardımcısı modül kapısını ortak kullanır; sektör ve açıklık kontrolü orada.
  await requireVenueModule(db, tenantId, key);
}

export async function listOrgEvents(db: Db, tenantId: string): Promise<OrgEventRow[]> {
  await requireOrg(db, tenantId, "org_events");
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<Record<string, unknown>>(
      `SELECT e.id, e.title, e.client_name, e.client_phone, e.event_date::text AS d, e.location, e.guest_count, e.budget_tl::float8 AS budget,
              e.status, e.note,
              (SELECT count(*)::int FROM org_tasks t WHERE t.event_id = e.id) AS task_total,
              (SELECT count(*)::int FROM org_tasks t WHERE t.event_id = e.id AND t.done) AS task_done,
              COALESCE((SELECT sum(c.amount_tl) FROM org_costs c WHERE c.event_id = e.id), 0)::float8 AS cost_total,
              COALESCE((SELECT sum(c.amount_tl) FROM org_costs c WHERE c.event_id = e.id AND c.paid), 0)::float8 AS cost_paid,
              COALESCE((SELECT array_agg(s.staff_id) FROM org_event_staff s WHERE s.event_id = e.id), '{}') AS staff_ids
       FROM org_events e ORDER BY e.event_date, e.created_at`,
    );
    return r.rows.map((x) => ({
      id: String(x.id), title: String(x.title), clientName: String(x.client_name), clientPhone: String(x.client_phone), eventDate: String(x.d),
      location: String(x.location), guestCount: x.guest_count === null ? null : Number(x.guest_count), budgetTl: Number(x.budget),
      status: x.status as EventStatus, note: String(x.note), taskTotal: Number(x.task_total), taskDone: Number(x.task_done),
      costTotal: Number(x.cost_total), costPaid: Number(x.cost_paid), staffIds: (x.staff_ids as string[]).map(String),
    }));
  });
}

export async function getOrgEvent(db: Db, tenantId: string, id: string) {
  const all = await listOrgEvents(db, tenantId);
  const event = all.find((e) => e.id === id);
  if (!event) throw new AppError(404, "not_found");
  return withTenant(db, tenantId, async (tx) => {
    const tasks = await tx.query<Record<string, unknown>>("SELECT id, title, due_date::text AS d, done, assignee_id FROM org_tasks WHERE event_id = $1 ORDER BY done, due_date NULLS LAST, created_at", [id]);
    const costs = await tx.query<Record<string, unknown>>("SELECT id, name, category, amount_tl::float8 AS amount, paid FROM org_costs WHERE event_id = $1 ORDER BY created_at", [id]);
    const staff = await tx.query<{ id: string; name: string }>("SELECT id, name FROM staff ORDER BY name");
    return {
      event,
      tasks: tasks.rows.map((x): OrgTask => ({ id: String(x.id), title: String(x.title), dueDate: x.d ? String(x.d) : null, done: Boolean(x.done), assigneeId: x.assignee_id ? String(x.assignee_id) : null })),
      costs: costs.rows.map((x): OrgCost => ({ id: String(x.id), name: String(x.name), category: String(x.category), amountTl: Number(x.amount), paid: Boolean(x.paid) })),
      staff: staff.rows.map((x) => ({ id: String(x.id), name: String(x.name) })),
    };
  });
}

export async function saveOrgEvent(db: Db, tenantId: string, id: string | null, raw: unknown, actor?: string): Promise<string> {
  await requireOrg(db, tenantId, "org_events");
  const b = (raw ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 160) : "";
  const clientName = typeof b.clientName === "string" ? b.clientName.trim().slice(0, 120) : "";
  const clientPhone = phone(b.clientPhone);
  const eventDate = validDate(b.eventDate);
  const location = typeof b.location === "string" ? b.location.trim().slice(0, 200) : "";
  const guests = b.guestCount === undefined || b.guestCount === null || b.guestCount === "" ? null : Number(b.guestCount);
  const budget = money(b.budgetTl, 0);
  const status = typeof b.status === "string" && (EVENT_STATUSES as readonly string[]).includes(b.status) ? b.status : "taslak";
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 1000) : "";
  const bad: string[] = [];
  if (title.length < 2) bad.push("title");
  if (!eventDate) bad.push("eventDate");
  if (clientPhone === null) bad.push("clientPhone");
  if (guests !== null && (!Number.isInteger(guests) || guests < 1 || guests > 50000)) bad.push("guestCount");
  if (budget === null) bad.push("budgetTl");
  if (bad.length) throw new AppError(422, "validation", bad);
  const eid = id ?? randomUUID();
  await withTenant(db, tenantId, async (tx) => {
    if (id === null) {
      await tx.query(
        `INSERT INTO org_events (id, tenant_id, title, client_name, client_phone, event_date, location, guest_count, budget_tl, status, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [eid, tenantId, title, clientName, clientPhone ?? "", eventDate, location, guests, budget, status, note],
      );
      await audit(tx, tenantId, actor, "org.event.create", eid, { title });
    } else {
      const r = await tx.query(
        `UPDATE org_events SET title = $2, client_name = $3, client_phone = $4, event_date = $5, location = $6, guest_count = $7, budget_tl = $8, status = $9, note = $10
         WHERE id = $1 RETURNING id`,
        [eid, title, clientName, clientPhone ?? "", eventDate, location, guests, budget, status, note],
      );
      if (!r.rows.length) throw new AppError(404, "not_found");
      await audit(tx, tenantId, actor, "org.event.update", eid, { status });
    }
  });
  return eid;
}

export async function deleteOrgEvent(db: Db, tenantId: string, id: string, actor?: string): Promise<void> {
  await requireOrg(db, tenantId, "org_events");
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("DELETE FROM org_events WHERE id = $1 RETURNING id", [id]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "org.event.delete", id, {});
  });
}

// Ekip ataması: yalnızca bu işletmenin personeli atanabilir.
export async function setOrgEventStaff(db: Db, tenantId: string, eventId: string, staffIds: unknown, actor?: string): Promise<void> {
  await requireOrg(db, tenantId, "org_events");
  if (!Array.isArray(staffIds) || !staffIds.every((x) => typeof x === "string")) throw new AppError(422, "validation", ["staffIds"]);
  const ids = [...new Set(staffIds as string[])];
  await withTenant(db, tenantId, async (tx) => {
    const ev = await tx.query("SELECT id FROM org_events WHERE id = $1", [eventId]);
    if (!ev.rows.length) throw new AppError(404, "not_found");
    if (ids.length) {
      const ok = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM staff WHERE id = ANY($1::text[])", [ids]);
      if (Number(ok.rows[0].n) !== ids.length) throw new AppError(422, "validation", ["staffIds"]);
    }
    await tx.query("DELETE FROM org_event_staff WHERE event_id = $1", [eventId]);
    for (const sid of ids) await tx.query("INSERT INTO org_event_staff (tenant_id, event_id, staff_id) VALUES ($1, $2, $3)", [tenantId, eventId, sid]);
    await audit(tx, tenantId, actor, "org.event.staff", eventId, { count: ids.length });
  });
}

export async function addOrgTask(db: Db, tenantId: string, eventId: string, raw: unknown, actor?: string): Promise<void> {
  await requireOrg(db, tenantId, "org_tasks");
  const b = (raw ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 160) : "";
  const due = b.dueDate ? validDate(b.dueDate) : null;
  const assignee = typeof b.assigneeId === "string" && b.assigneeId ? b.assigneeId : null;
  const bad: string[] = [];
  if (title.length < 2) bad.push("title");
  if (b.dueDate && !due) bad.push("dueDate");
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    const ev = await tx.query("SELECT id FROM org_events WHERE id = $1", [eventId]);
    if (!ev.rows.length) throw new AppError(404, "not_found");
    await tx.query("INSERT INTO org_tasks (id, tenant_id, event_id, title, due_date, assignee_id) VALUES ($1, $2, $3, $4, $5, $6)", [randomUUID(), tenantId, eventId, title, due, assignee]);
    await audit(tx, tenantId, actor, "org.task.add", eventId, {});
  });
}

export async function setOrgTaskDone(db: Db, tenantId: string, taskId: string, done: unknown, actor?: string): Promise<void> {
  await requireOrg(db, tenantId, "org_tasks");
  if (typeof done !== "boolean") throw new AppError(422, "validation", ["done"]);
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("UPDATE org_tasks SET done = $2 WHERE id = $1 RETURNING id", [taskId, done]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "org.task.done", taskId, { done });
  });
}

export async function deleteOrgTask(db: Db, tenantId: string, taskId: string, actor?: string): Promise<void> {
  await requireOrg(db, tenantId, "org_tasks");
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("DELETE FROM org_tasks WHERE id = $1 RETURNING id", [taskId]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "org.task.delete", taskId, {});
  });
}

export async function addOrgCost(db: Db, tenantId: string, eventId: string, raw: unknown, actor?: string): Promise<void> {
  await requireOrg(db, tenantId, "org_budget");
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  const category = typeof b.category === "string" && (COST_CATEGORIES as readonly string[]).includes(b.category) ? b.category : "diger";
  const amount = money(b.amountTl, 0);
  const bad: string[] = [];
  if (name.length < 2) bad.push("name");
  if (amount === null || b.amountTl === undefined || b.amountTl === "") bad.push("amountTl");
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    const ev = await tx.query("SELECT id FROM org_events WHERE id = $1", [eventId]);
    if (!ev.rows.length) throw new AppError(404, "not_found");
    await tx.query("INSERT INTO org_costs (id, tenant_id, event_id, name, category, amount_tl) VALUES ($1, $2, $3, $4, $5, $6)", [randomUUID(), tenantId, eventId, name, category, amount ?? 0]);
    await audit(tx, tenantId, actor, "org.cost.add", eventId, { category });
  });
}

export async function setOrgCostPaid(db: Db, tenantId: string, costId: string, paid: unknown, actor?: string): Promise<void> {
  await requireOrg(db, tenantId, "org_budget");
  if (typeof paid !== "boolean") throw new AppError(422, "validation", ["paid"]);
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("UPDATE org_costs SET paid = $2 WHERE id = $1 RETURNING id", [costId, paid]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "org.cost.paid", costId, { paid });
  });
}

export async function deleteOrgCost(db: Db, tenantId: string, costId: string, actor?: string): Promise<void> {
  await requireOrg(db, tenantId, "org_budget");
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("DELETE FROM org_costs WHERE id = $1 RETURNING id", [costId]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "org.cost.delete", costId, {});
  });
}
