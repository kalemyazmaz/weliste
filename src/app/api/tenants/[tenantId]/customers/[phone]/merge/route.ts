import { getDb } from "@/lib/db";
import { readJson, requireMember, route } from "@/lib/http";
import { mergeCustomers } from "@/lib/customers";
import { assertCan } from "@/lib/permissions";
import { normalizePhone } from "@/lib/service";
import { AppError } from "@/lib/errors";

type Ctx = { params: Promise<{ tenantId: string; phone: string }> };

// Bu müşteriyi { "into": "05..." } ile verilen hedef müşteriye birleştirir (yalnızca sahip).
export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, phone } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_customer_records");
    const body = (await readJson(req)) as { into?: unknown } | null;
    const into = normalizePhone(body?.into);
    if (!into) throw new AppError(422, "validation", ["into"]);
    await mergeCustomers(db, tenantId, phone, into, userId);
    return Response.json({ ok: true, into });
  });
}
