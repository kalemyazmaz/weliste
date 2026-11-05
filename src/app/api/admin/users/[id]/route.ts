import { getDb } from "@/lib/db";
import { readJson, readToken, route } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security";
import { requireAdmin, setAdminUserFlags } from "@/lib/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  return route(async () => {
    assertSameOrigin(req);
    const db = getDb();
    const admin = await requireAdmin(db, readToken(req));
    const { id } = await ctx.params;
    await setAdminUserFlags(db, admin.id, id, await readJson(req));
    return Response.json({ ok: true });
  });
}
