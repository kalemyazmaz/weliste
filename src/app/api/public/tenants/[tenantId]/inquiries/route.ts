import { getDb } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { assertNotLocked, assertSameOrigin, clientIp, ipKeys, recordFailure } from "@/lib/security";
import { createPublicInquiry } from "@/lib/venue";

type Ctx = { params: Promise<{ tenantId: string }> };

// Müşterinin teklif talebi (oturumsuz). Hız sınırlı.
export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    assertSameOrigin(req);
    const { tenantId } = await ctx.params;
    const db = getDb();
    const keys = ipKeys("inquiry-ip", clientIp(req));
    await assertNotLocked(db, keys);
    await recordFailure(db, keys);
    await createPublicInquiry(db, tenantId, await readJson(req));
    return Response.json({ ok: true, message: "Teklif talebiniz alındı. İşletme sizinle iletişime geçecek." }, { status: 201 });
  });
}
