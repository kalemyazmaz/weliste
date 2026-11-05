import { randomUUID } from "node:crypto";
import { Db, withTenant } from "./db";
import { AppError } from "./errors";
import { audit, getTenant } from "./service";
import { ALL_SCOPE, Scope, scopeArgs } from "./scope";

// Randevu hatırlatmaları. Sağlayıcı bağlı değilse mesaj kuyruğa alınır ve işletme,
// panelde verilen wa.me bağlantısıyla mesajı kendisi gönderir, sonra "gönderildi" işaretler.

const DATE_FMT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long", timeZone: "Europe/Istanbul" });
const TIME_FMT = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

export function reminderBody(p: { customerName: string; tenantName: string; serviceName: string; startsAt: Date }): string {
  const first = p.customerName.split(" ")[0];
  return `Merhaba ${first}, ${p.tenantName} için ${DATE_FMT.format(p.startsAt)} saat ${TIME_FMT.format(p.startsAt)} tarihinde ` +
    `"${p.serviceName}" randevunuz var. Değişiklik için lütfen bizimle iletişime geçin.`;
}

export function waLink(phone: string, body: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}

// Önümüzdeki pencere içindeki onaylı randevular için, henüz kuyruğa alınmamış hatırlatmaları ekler.
export async function queueReminders(db: Db, tenantId: string, opts: { now?: Date; hours?: number } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const until = new Date(now.getTime() + (opts.hours ?? 24) * 3600 * 1000);
  const tenant = await getTenant(db, tenantId);
  if (!tenant) throw new AppError(404, "not_found");
  return withTenant(db, tenantId, async (tx) => {
    const rows = await tx.query<Record<string, unknown>>(
      `SELECT a.id, a.customer_name, a.customer_phone, a.service_name, a.starts_at
       FROM appointments a
       WHERE a.status = 'onaylandi' AND a.starts_at > $1 AND a.starts_at <= $2
         AND NOT EXISTS (SELECT 1 FROM reminder_messages r WHERE r.appointment_id = a.id)`,
      [now.toISOString(), until.toISOString()],
    );
    for (const r of rows.rows) {
      const startsAt = new Date(r.starts_at as string);
      const body = reminderBody({ customerName: String(r.customer_name), tenantName: tenant.name, serviceName: String(r.service_name), startsAt });
      await tx.query(
        `INSERT INTO reminder_messages (id, tenant_id, appointment_id, to_phone, body) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (appointment_id) DO NOTHING`,
        [randomUUID(), tenantId, String(r.id), String(r.customer_phone), body],
      );
    }
    return rows.rows.length;
  });
}

export interface ReminderRow { id: string; customerName: string; startsAt: string; to: string; body: string; link: string }

export async function listQueuedReminders(db: Db, tenantId: string, scope: Scope = ALL_SCOPE): Promise<ReminderRow[]> {
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<Record<string, unknown>>(
      `SELECT r.id, r.to_phone, r.body, a.customer_name, a.starts_at
       FROM reminder_messages r JOIN appointments a ON a.id = r.appointment_id
       WHERE r.status = 'queued' AND ($1::boolean OR a.staff_id = $2) ORDER BY a.starts_at`,
      scopeArgs(scope),
    );
    return r.rows.map((x) => ({
      id: String(x.id),
      customerName: String(x.customer_name),
      startsAt: new Date(x.starts_at as string).toISOString(),
      to: String(x.to_phone),
      body: String(x.body),
      link: waLink(String(x.to_phone), String(x.body)),
    }));
  });
}

export async function setReminderStatus(db: Db, tenantId: string, id: string, status: unknown, actor?: string, scope: Scope = ALL_SCOPE): Promise<void> {
  if (status !== "sent" && status !== "cancelled") throw new AppError(422, "validation", ["status"]);
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query(
      `UPDATE reminder_messages SET status = $2, sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END
       WHERE id = $1 AND status = 'queued'
         AND ($3::boolean OR appointment_id IN (SELECT id FROM appointments WHERE staff_id = $4))
       RETURNING id`,
      [id, status, ...scopeArgs(scope)],
    );
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, `reminder.${status}`, id, {});
  });
}

