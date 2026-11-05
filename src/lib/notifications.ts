import { Db, withTenant } from "./db";
import { Scope, scopeArgs } from "./scope";

export interface NotificationItem { key: string; title: string; description: string; count: number; href: string }

// Panel bildirimleri: yeni randevular, bugünkü randevular, bekleyen hatırlatmalar ve (sahip için) onay bekleyen yorumlar.
// Personel yalnızca kendi randevularının sayılarını görür.
export async function getNotifications(db: Db, tenantId: string, scope: Scope, isOwner: boolean): Promise<{ items: NotificationItem[]; total: number }> {
  const [allFlag, staffId] = scopeArgs(scope);
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date());
  const dayStart = new Date(`${today}T00:00:00+03:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const base = `/panel/${tenantId}`;

  return withTenant(db, tenantId, async (tx) => {
    const count = async (sql: string, params: unknown[]) => Number((await tx.query<{ n: number }>(sql, params)).rows[0].n);
    const newCount = await count(
      "SELECT count(*)::int AS n FROM appointments WHERE status = 'onaylandi' AND created_at > now() - interval '24 hours' AND ($1::boolean OR staff_id = $2)",
      [allFlag, staffId],
    );
    const todayCount = await count(
      "SELECT count(*)::int AS n FROM appointments WHERE status = 'onaylandi' AND starts_at >= $3 AND starts_at < $4 AND ($1::boolean OR staff_id = $2)",
      [allFlag, staffId, dayStart, dayEnd],
    );
    const reminderCount = await count(
      `SELECT count(*)::int AS n FROM reminder_messages r JOIN appointments a ON a.id = r.appointment_id
       WHERE r.status = 'queued' AND a.status = 'onaylandi' AND ($1::boolean OR a.staff_id = $2)`,
      [allFlag, staffId],
    );
    const items: NotificationItem[] = [
      { key: "new", title: "Yeni randevular", description: "Son 24 saatte alınan randevular", count: newCount, href: `${base}/randevular` },
      { key: "today", title: "Bugünkü randevular", description: "Bugün başlayan aktif randevular", count: todayCount, href: `${base}/randevular` },
      { key: "reminders", title: "Bekleyen hatırlatmalar", description: "Gönderilmeyi bekleyen müşteri mesajları", count: reminderCount, href: `${base}/randevular` },
    ];
    if (isOwner) {
      const reviewCount = await count("SELECT count(*)::int AS n FROM reviews WHERE status = 'pending'", []);
      items.push({ key: "reviews", title: "Onay bekleyen yorumlar", description: "Müşteri sayfasında yayınlanmayı bekliyor", count: reviewCount, href: `${base}/isletme-profili` });
    }
    return { items, total: items.reduce((a, i) => a + i.count, 0) };
  });
}
