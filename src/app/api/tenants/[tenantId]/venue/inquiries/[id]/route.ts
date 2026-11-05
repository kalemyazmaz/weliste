import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { setVenueInquiryStatus } from "@/lib/venue";

type Ctx = { params: Promise<{ tenantId: string; id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_customers");
    const body = (await readJson(req)) as { status?: unknown } | null;
    await setVenueInquiryStatus(db, tenantId, id, body?.status, userId);
    return Response.json({ ok: true });
  });
}
