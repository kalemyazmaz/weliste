import { getDb } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { assertNotLocked, assertSameOrigin, clientIp, ipKeys, recordFailure } from "@/lib/security";
import { addPublicReview } from "@/lib/business-profile";

type Ctx = { params: Promise<{ tenantId: string }> };

// Müşteri yorumu (oturumsuz). Yorum işletme onayından sonra yayınlanır.
export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    assertSameOrigin(req);
    const { tenantId } = await ctx.params;
    const db = getDb();
    const keys = ipKeys("review-ip", clientIp(req));
    await assertNotLocked(db, keys);
    await recordFailure(db, keys);
    await addPublicReview(db, tenantId, await readJson(req));
    return Response.json({ ok: true, message: "Yorumunuz alındı. İşletme onayladıktan sonra yayınlanır." }, { status: 201 });
  });
}
