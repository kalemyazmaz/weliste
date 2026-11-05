import { getDb } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { assertNotLocked, assertSameOrigin, clientIp, ipKeys, recordFailure } from "@/lib/security";
import { createAppointment } from "@/lib/appointments";

type Ctx = { params: Promise<{ tenantId: string }> };

// Müşterinin oturumsuz randevu alma ucu. Her istek IP sınırına sayılır.
// IP güvenilir değilse IP sınırı uygulanmaz; bu durumda doğrulama ve CSRF kontrolü devrededir.
export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    assertSameOrigin(req);
    const { tenantId } = await ctx.params;
    const db = getDb();
    const keys = ipKeys("appt-ip", clientIp(req));
    await assertNotLocked(db, keys);
    await recordFailure(db, keys);
    const created = await createAppointment(db, tenantId, await readJson(req), { publicBooking: true });
    return Response.json({ ok: true, id: created.id, startsAt: created.startsAt }, { status: 201 });
  });
}
