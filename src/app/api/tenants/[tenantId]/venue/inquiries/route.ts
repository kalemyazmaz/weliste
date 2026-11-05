import { getDb } from "@/lib/db";
import { requireMember, route } from "@/lib/http";
import { listVenueInquiries } from "@/lib/venue";

type Ctx = { params: Promise<{ tenantId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    await requireMember(db, req, tenantId);
    return Response.json({ items: await listVenueInquiries(db, tenantId) });
  });
}
