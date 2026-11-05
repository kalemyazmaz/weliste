import { getDb } from "@/lib/db";
import { requireMember, route } from "@/lib/http";
import { getNotifications } from "@/lib/notifications";
import { scopeFor } from "@/lib/scope";

type Ctx = { params: Promise<{ tenantId: string }> };

// Panel bildirimleri. Personel yalnızca kendi randevularının sayılarını görür.
export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    const scope = await scopeFor(db, tenantId, userId, role);
    return Response.json(await getNotifications(db, tenantId, scope, role === "owner"));
  });
}
