import { getDb } from "@/lib/db";
import { readJson, requireMember, route } from "@/lib/http";
import { addGalleryPhoto } from "@/lib/business-profile";
import { assertCan } from "@/lib/permissions";

type Ctx = { params: Promise<{ tenantId: string }> };

// Galeriye fotoğraf ekler: { "image": "data:image/jpeg;base64,..." } (yalnızca sahip).
export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_profile");
    const id = await addGalleryPhoto(db, tenantId, await readJson(req), userId);
    return Response.json({ ok: true, id }, { status: 201 });
  });
}
