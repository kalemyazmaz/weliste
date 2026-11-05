import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { getSlots } from "@/lib/appointments";

type Ctx = { params: Promise<{ tenantId: string }> };

// Herkese açık: yalnızca yayınlanmış işletmenin boş saatlerini döner.
// Dönen veride müşteri ya da başka randevu bilgisi yoktur.
export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const url = new URL(req.url);
    const slots = await getSlots(getDb(), tenantId, {
      serviceId: url.searchParams.get("serviceId") ?? "",
      date: url.searchParams.get("date") ?? "",
      staffId: url.searchParams.get("staffId"),
      publicOnly: true,
    });
    return Response.json({ items: slots });
  });
}
