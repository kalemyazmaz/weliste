import { getDb } from "@/lib/db";
import { readJson, readToken, route } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security";
import { requireAdmin } from "@/lib/admin";
import { saveSiteSetting } from "@/lib/site";

type Ctx = { params: Promise<{ key: string }> };

// Site içeriği ve ayarları (home, header, footer, theme). Değerler sunucuda doğrulanır.
export async function PUT(req: Request, ctx: Ctx) {
  return route(async () => {
    assertSameOrigin(req);
    const db = getDb();
    await requireAdmin(db, readToken(req));
    const { key } = await ctx.params;
    await saveSiteSetting(db, key, await readJson(req));
    return Response.json({ ok: true });
  });
}
