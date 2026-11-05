import { getDb } from "@/lib/db";
import { requireMember, route } from "@/lib/http";
import { removeMember } from "@/lib/members";
import { assertCan } from "@/lib/permissions";

type Ctx = { params: Promise<{ tenantId: string; userId: string }> };

// Yalnızca sahip üye çıkarır; sahip kendini çıkaramaz.
export async function DELETE(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, userId: target } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_members");
    await removeMember(db, tenantId, target, userId);
    return Response.json({ ok: true });
  });
}
