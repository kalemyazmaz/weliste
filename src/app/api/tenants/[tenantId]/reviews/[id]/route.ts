import { getDb } from "@/lib/db";
import { readJson, requireMember, route } from "@/lib/http";
import { setReviewStatus } from "@/lib/business-profile";
import { assertCan } from "@/lib/permissions";

type Ctx = { params: Promise<{ tenantId: string; id: string }> };

// Yorumu göster ya da gizle: { "status": "shown" | "hidden" } (yalnızca sahip).
export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, id } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_profile");
    const body = (await readJson(req)) as { status?: unknown } | null;
    await setReviewStatus(db, tenantId, id, body?.status, userId);
    return Response.json({ ok: true });
  });
}
