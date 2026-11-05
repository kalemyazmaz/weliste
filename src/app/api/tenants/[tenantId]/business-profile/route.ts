import { getDb } from "@/lib/db";
import { readJson, requireMember, route } from "@/lib/http";
import { saveBusinessProfile } from "@/lib/business-profile";
import { assertCan } from "@/lib/permissions";

type Ctx = { params: Promise<{ tenantId: string }> };

// İşletme profili bilgileri (kısmi güncelleme; yalnızca sahip).
export async function PUT(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_profile");
    await saveBusinessProfile(db, tenantId, await readJson(req), userId);
    return Response.json({ ok: true });
  });
}
