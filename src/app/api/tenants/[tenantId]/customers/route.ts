import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { createCustomer } from "@/lib/customers";

type Ctx = { params: Promise<{ tenantId: string }> };

// Randevusuz müşteri ekleme: { "name": "...", "phone": "05..." }.
export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_customers");
    const phone = await createCustomer(db, tenantId, await readJson(req), userId);
    return Response.json({ ok: true, phone }, { status: 201 });
  });
}
