import { getDb } from "@/lib/db";
import { readJson, requireMember, route } from "@/lib/http";
import { inviteMember, listMembers } from "@/lib/members";
import { assertCan } from "@/lib/permissions";

type Ctx = { params: Promise<{ tenantId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    await requireMember(db, req, tenantId);
    return Response.json({ items: await listMembers(db, tenantId) });
  });
}

// Yalnızca sahip davet eder.
export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_members");
    const body = (await readJson(req)) as { email?: unknown } | null;
    await inviteMember(db, tenantId, body?.email, new URL(req.url).origin, userId);
    return Response.json({ ok: true }, { status: 201 });
  });
}
