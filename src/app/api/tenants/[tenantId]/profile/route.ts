import { assertCan } from "@/lib/permissions";
import { getDb } from "@/lib/db";
import { readJson, requireMember, route } from "@/lib/http";
import { getProfile, saveProfile } from "@/lib/workspace";

type Ctx = { params: Promise<{ tenantId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    await requireMember(db, req, tenantId);
    return Response.json({ profile: await getProfile(db, tenantId) });
  });
}

export async function PUT(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_profile");
    if (role !== "owner") return Response.json({ error: "forbidden" }, { status: 403 });
    await saveProfile(db, tenantId, await readJson(req), userId);
    return Response.json({ ok: true });
  });
}
