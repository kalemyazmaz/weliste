import { getDb } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { assertNotLocked, assertSameOrigin, clientIp, ipKeys, recordFailure } from "@/lib/security";
import { getPublicDelivery, submitDeliverySelection } from "@/lib/delivery";

type Ctx = { params: Promise<{ tenantId: string; token: string }> };

// Müşterinin teslim sayfası (oturumsuz, tokenli).
export async function GET(_req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, token } = await ctx.params;
    return Response.json(await getPublicDelivery(getDb(), tenantId, token));
  });
}

// Müşteri seçimi. Hız sınırlı; tek seferlik gönderim.
export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    assertSameOrigin(req);
    const { tenantId, token } = await ctx.params;
    const db = getDb();
    const keys = ipKeys("delivery-ip", clientIp(req));
    await assertNotLocked(db, keys);
    await recordFailure(db, keys);
    await submitDeliverySelection(db, tenantId, token, await readJson(req));
    return Response.json({ ok: true, message: "Seçiminiz alındı. Teşekkür ederiz." }, { status: 201 });
  });
}
