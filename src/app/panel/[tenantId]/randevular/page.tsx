import { getModules } from "@/lib/modules";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUser, membershipRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/http";
import { getTenant } from "@/lib/service";
import { listAppointments } from "@/lib/appointments";
import { getProfile, listServices, listStaff } from "@/lib/workspace";
import { isSectorKey, SECTORS } from "@/lib/sectors";
import { AppointmentManager } from "./AppointmentManager";
import { ReminderList } from "./ReminderList";
import { PanelShell } from "@/components/panel-shell";
import { listQueuedReminders, queueReminders } from "@/lib/reminders";
import { scopeFor } from "@/lib/scope";

export const dynamic = "force-dynamic";

const DAY_KEY = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Istanbul" });
const DAY_LABEL = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00+03:00`);
  d.setTime(d.getTime() + delta * 86400000);
  return DAY_KEY.format(d);
}

// Randevu sektörü işletmelerinin günlük randevu ekranı. Yalnızca üyeler görür.
export default async function AppointmentsPage({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<{ gun?: string; tel?: string; ad?: string }> }) {
  const { tenantId } = await params;
  const { gun, tel, ad } = await searchParams;
  const initialPhone = tel && /^\d{10,15}$/.test(tel) ? tel : "";
  const initialName = ad ? ad.slice(0, 120) : "";
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  const user = token ? await currentUser(db, token) : null;
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/${tenantId}/randevular`)}`);

  const role = await membershipRole(db, user.id, tenantId);
  const scope = await scopeFor(db, tenantId, user.id, role!);
  if (!role) notFound();
  const tenant = await getTenant(db, tenantId);
  const modules = await getModules(db, tenantId);
  if (!tenant) notFound();

  const today = DAY_KEY.format(new Date());
  const day = gun && /^\d{4}-\d{2}-\d{2}$/.test(gun) ? gun : today;
  const [items, services, staff, profile] = await Promise.all([
    listAppointments(db, tenantId, day, scope),
    listServices(db, tenantId),
    listStaff(db, tenantId),
    getProfile(db, tenantId),
  ]);
  // Yaklaşan randevuların hatırlatmaları kuyruğa alınır; bekleyenler panelde listelenir.
  await queueReminders(db, tenantId);
  const reminders = await listQueuedReminders(db, tenantId, scope);
  // Seçilen günün saatleri (kapalı günde null).
  const weekday = new Date(`${day}T12:00:00+03:00`).getUTCDay();
  const dayHours = profile.dayHours[weekday] ?? null;
  const sectorLabel = tenant.sector && isSectorKey(tenant.sector) ? SECTORS[tenant.sector].label : null;

  return (
    <PanelShell
      tenantId={tenantId}
      tenantName={tenant.name}
      sectorLabel={sectorLabel}
      current="randevular"
      modules={modules}
      role={role!}
      publicHref={tenant.sector && isSectorKey(tenant.sector) ? `/randevu/${tenant.sector}/${tenantId}` : null}
      title="Randevular"
    >

      {!tenant.sector || !isSectorKey(tenant.sector) ? (
        <section style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
          <p style={{ margin: 0 }}>Bu işletmenin randevu sektörü seçilmemiş. Randevu almak için sektör gereklidir.</p>
        </section>
      ) : (
        <>
          <nav aria-label="Gün seçimi" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Link href={`/panel/${tenantId}/randevular?gun=${shiftDay(day, -1)}`}>← Önceki gün</Link>
            <strong style={{ textTransform: "capitalize" }}>{DAY_LABEL.format(new Date(`${day}T12:00:00+03:00`))}</strong>
            <Link href={`/panel/${tenantId}/randevular?gun=${shiftDay(day, 1)}`}>Sonraki gün →</Link>
            {day !== today && <Link href={`/panel/${tenantId}/randevular`}>Bugün</Link>}
          </nav>
          {modules.reminders && <ReminderList tenantId={tenantId} items={reminders} />}
          <AppointmentManager
            tenantId={tenantId}
            initialPhone={initialPhone}
            initialName={initialName}
            hours={dayHours}
            day={day}
            items={items}
            services={services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin }))}
            staff={staff.map((s) => ({ id: s.id, name: s.name }))}
          />
        </>
      )}
    </PanelShell>
  );
}
