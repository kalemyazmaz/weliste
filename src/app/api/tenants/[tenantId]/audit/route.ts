import { getDb } from "@/lib/db";
import { requireMember, route } from "@/lib/http";
import { listAudit } from "@/lib/service";
import { assertCan } from "@/lib/permissions";

type Ctx = { params: Promise<{ tenantId: string }> };

// Audit trail is visible to owners only.
export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { role } = await requireMember(db, req, tenantId);
    assertCan(role, "view_audit");
    return Response.json({ events: await listAudit(db, tenantId) });
  });
}
