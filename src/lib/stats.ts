import { Db, withTenant } from "./db";
import { TZ } from "./appointments";
import { getProfile } from "./workspace";

// Son N gün için randevu istatistikleri. Doluluk, işletmenin gün bazlı çalışma saatlerine göre hesaplanır.

const DAY_MS = 24 * 3600 * 1000;

function istanbulToday(now = new Date()): string {
  const f = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Istanbul" });
  return f.format(now);
}

export interface Stats {
  days: number;
  total: number;
  completed: number;
  noShow: number;
  cancelled: number;
  upcoming: number;
  noShowRate: number; // gelmedi / (tamamlandı + gelmedi)
  bookedMin: number;
  availableMin: number;
  occupancy: number; // 0-1
  topServices: Array<{ name: string; count: number }>;
  byStaff: Array<{ name: string; count: number }>;
}

export async function getStats(db: Db, tenantId: string, days = 30, now = new Date()): Promise<Stats> {
  const today = istanbulToday(now);
  const startMs = new Date(`${today}T00:00:00${TZ}`).getTime() - (days - 1) * DAY_MS;
  const endMs = new Date(`${today}T00:00:00${TZ}`).getTime() + DAY_MS;
  const profile = await getProfile(db, tenantId);

  return withTenant(db, tenantId, async (tx) => {
    const counts = await tx.query<Record<string, unknown>>(
      `SELECT status, count(*)::int AS n FROM appointments WHERE starts_at >= $1 AND starts_at < $2 GROUP BY status`,
      [new Date(startMs).toISOString(), new Date(endMs).toISOString()],
    );
    const byStatus: Record<string, number> = {};
    for (const r of counts.rows) byStatus[String(r.status)] = Number(r.n);
    const upcoming = await tx.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM appointments WHERE status = 'onaylandi' AND starts_at >= now()`,
    );
    const booked = await tx.query<{ m: string }>(
      `SELECT COALESCE(sum(EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60), 0)::text AS m FROM appointments
       WHERE status IN ('onaylandi', 'tamamlandi', 'gelmedi') AND starts_at >= $1 AND starts_at < $2`,
      [new Date(startMs).toISOString(), new Date(endMs).toISOString()],
    );
    const top = await tx.query<Record<string, unknown>>(
      `SELECT service_name AS name, count(*)::int AS n FROM appointments
       WHERE starts_at >= $1 AND starts_at < $2 AND status <> 'iptal'
       GROUP BY service_name ORDER BY n DESC LIMIT 5`,
      [new Date(startMs).toISOString(), new Date(endMs).toISOString()],
    );
    const staffRows = await tx.query<Record<string, unknown>>(
      `SELECT s.name AS name, count(a.id)::int AS n FROM staff s
       LEFT JOIN appointments a ON a.staff_id = s.id AND a.status <> 'iptal' AND a.starts_at >= $1 AND a.starts_at < $2
       WHERE s.tenant_id = $3 GROUP BY s.id, s.name ORDER BY n DESC, s.name`,
      [new Date(startMs).toISOString(), new Date(endMs).toISOString(), tenantId],
    );

    // Kullanılabilir dakika: her günün çalışma saatleri (kapalı günler 0)
    let availableMin = 0;
    for (let i = 0; i < days; i++) {
      const dayStart = startMs + i * DAY_MS;
      const date = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(dayStart + 12 * 3600 * 1000));
      const wd = new Date(`${date}T12:00:00${TZ}`).getUTCDay();
      const h = profile.dayHours[wd];
      availableMin += h ? h.close - h.open : 0;
    }

    const completed = byStatus.tamamlandi ?? 0;
    const noShow = byStatus.gelmedi ?? 0;
    const bookedMin = Number(booked.rows[0].m);
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    return {
      days,
      total,
      completed,
      noShow,
      cancelled: byStatus.iptal ?? 0,
      upcoming: upcoming.rows[0].n,
      noShowRate: completed + noShow > 0 ? noShow / (completed + noShow) : 0,
      bookedMin,
      availableMin,
      occupancy: availableMin > 0 ? Math.min(bookedMin / availableMin, 1) : 0,
      topServices: top.rows.map((r) => ({ name: String(r.name), count: Number(r.n) })),
      byStaff: staffRows.rows.map((r) => ({ name: String(r.name), count: Number(r.n) })),
    };
  });
}
