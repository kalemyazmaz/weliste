import { getDb } from "@/lib/db";
import { readJson, readToken, route } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security";
import { requireAdmin, saveAdminPackage } from "@/lib/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  return route(async () => {
    assertSameOrigin(req);
    const db = getDb();
    await requireAdmin(db, readToken(req));
    const { id } = await ctx.params;
    await saveAdminPackage(db, id, await readJson(req));
    return Response.json({ ok: true });
  });
}
