import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { createAppointment, listAppointments } from "@/lib/appointments";
import { scopeFor } from "@/lib/scope";
import { AppError } from "@/lib/errors";

type Ctx = { params: Promise<{ tenantId: string }> };

// Üye yalnızca kendi randevularını görür.
export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    const scope = await scopeFor(db, tenantId, userId, role);
    const date = new URL(req.url).searchParams.get("date") ?? "";
    return Response.json({ items: await listAppointments(db, tenantId, date, scope) });
  });
}

// İşletme tarafından eklenen randevu. Üye randevusu kendi personel kaydına yazılır.
export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_appointments");
    const scope = await scopeFor(db, tenantId, userId, role);
    if (!scope.all && !scope.staffId) throw new AppError(403, "forbidden");
    const created = await createAppointment(db, tenantId, await readJson(req), {
      actor: userId,
      publicBooking: false,
      forceStaffId: scope.all ? undefined : (scope.staffId ?? undefined),
    });
    return Response.json({ ok: true, id: created.id, startsAt: created.startsAt }, { status: 201 });
  });
}
