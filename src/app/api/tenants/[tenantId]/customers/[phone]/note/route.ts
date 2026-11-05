import { getDb } from "@/lib/db";
import { readJson, requireMember, route } from "@/lib/http";
import { saveCustomerNote } from "@/lib/customers";
import { scopeFor } from "@/lib/scope";

type Ctx = { params: Promise<{ tenantId: string; phone: string }> };

// Müşteri notunu kaydeder: { "note": "..." }. Üye yalnızca kendi müşterilerine not yazabilir.
export async function PUT(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, phone } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    const scope = await scopeFor(db, tenantId, userId, role);
    const body = (await readJson(req)) as { note?: unknown } | null;
    await saveCustomerNote(db, tenantId, phone, body?.note, userId, scope);
    return Response.json({ ok: true });
  });
}
