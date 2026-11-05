import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { getSharedAvailability } from "@/lib/venue";

type Ctx = { params: Promise<{ tenantId: string; token: string }> };

// Paylaşılan müsaitlik (oturumsuz, tokenli). Kişi bilgisi döndürmez.
export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, token } = await ctx.params;
    const sp = new URL(req.url).searchParams;
    return Response.json(await getSharedAvailability(getDb(), tenantId, token, sp.get("from") ?? "", sp.get("to") ?? ""));
  });
}
