import { getDb } from "@/lib/db";
import { readJson, readToken, route } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security";
import { requireAdmin, setAdminModule } from "@/lib/admin";

type Ctx = { params: Promise<{ key: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  return route(async () => {
    assertSameOrigin(req);
    const db = getDb();
    await requireAdmin(db, readToken(req));
    const { key } = await ctx.params;
    await setAdminModule(db, key, await readJson(req));
    return Response.json({ ok: true });
  });
}
