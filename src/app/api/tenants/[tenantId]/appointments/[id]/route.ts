import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { cancelAppointment, rescheduleAppointment, setAppointmentOutcome } from "@/lib/appointments";
import { scopeFor } from "@/lib/scope";

type Ctx = { params: Promise<{ tenantId: string; id: string }> };

// Randevu sonucu, taşıma veya iptal. Üye yalnızca kendi randevularında işlem yapabilir.
export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_appointments");
    const scope = await scopeFor(db, tenantId, userId, role);
    const body = (await readJson(req)) as { status?: unknown; date?: unknown; time?: unknown } | null;
    if (body && (body.date !== undefined || body.time !== undefined)) {
      await rescheduleAppointment(db, tenantId, id, body, userId, scope);
    } else {
      await setAppointmentOutcome(db, tenantId, id, body?.status, userId, scope);
    }
    return Response.json({ ok: true });
  });
}

// Randevu iptali. Silme yoktur; kayıt durumu "iptal" olur ve slot yeniden boşalır.
export async function DELETE(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_appointments");
    const scope = await scopeFor(db, tenantId, userId, role);
    await cancelAppointment(db, tenantId, id, userId, scope);
    return Response.json({ ok: true });
  });
}
