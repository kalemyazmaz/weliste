import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { deleteOrgTask, setOrgTaskDone } from "@/lib/org";

type Ctx = { params: Promise<{ tenantId: string; taskId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, taskId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_appointments");
    const body = (await readJson(req)) as { done?: unknown } | null;
    await setOrgTaskDone(db, tenantId, taskId, body?.done, userId);
    return Response.json({ ok: true });
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, taskId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_appointments");
    await deleteOrgTask(db, tenantId, taskId, userId);
    return Response.json({ ok: true });
  });
}
