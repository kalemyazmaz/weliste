import { getDb } from "@/lib/db";
import { requireMember, route } from "@/lib/http";
import { listQueuedReminders, queueReminders } from "@/lib/reminders";
import { scopeFor } from "@/lib/scope";

type Ctx = { params: Promise<{ tenantId: string }> };

// Yaklaşan (24 saat) randevular için hatırlatmaları kuyruğa alır; üye yalnızca kendi müşterilerini görür.
export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    const scope = await scopeFor(db, tenantId, userId, role);
    const queued = await queueReminders(db, tenantId);
    return Response.json({ queued, items: await listQueuedReminders(db, tenantId, scope) });
  });
}
