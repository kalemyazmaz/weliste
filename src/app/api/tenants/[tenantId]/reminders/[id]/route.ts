import { getDb } from "@/lib/db";
import { readJson, requireMember, route } from "@/lib/http";
import { setReminderStatus } from "@/lib/reminders";
import { scopeFor } from "@/lib/scope";

type Ctx = { params: Promise<{ tenantId: string; id: string }> };

// İşletme mesajı gönderdiyse "sent", vazgeçtiyse "cancelled" olarak işaretler.
export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    const scope = await scopeFor(db, tenantId, userId, role);
    const body = (await readJson(req)) as { status?: unknown } | null;
    await setReminderStatus(db, tenantId, id, body?.status, userId, scope);
    return Response.json({ ok: true });
  });
}
