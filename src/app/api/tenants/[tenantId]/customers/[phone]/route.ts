import { getDb } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import { readJson, requireMember, route } from "@/lib/http";
import { deleteCustomerRecord, getCustomerDetail, saveCustomerProfile } from "@/lib/customers";
import { scopeFor } from "@/lib/scope";
import { AppError } from "@/lib/errors";

type Ctx = { params: Promise<{ tenantId: string; phone: string }> };

// Müşteri detayı: profil, not ve randevu geçmişi (kapsama göre).
export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, phone } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    const scope = await scopeFor(db, tenantId, userId, role);
    const detail = await getCustomerDetail(db, tenantId, phone, scope);
    if (!detail) throw new AppError(404, "not_found");
    return Response.json(detail);
  });
}

// Profil güncelleme: ad, e-posta, doğum tarihi, cinsiyet, fotoğraf.
export async function PUT(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, phone } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_customers");
    const scope = await scopeFor(db, tenantId, userId, role);
    await saveCustomerProfile(db, tenantId, phone, await readJson(req), userId, scope);
    return Response.json({ ok: true });
  });
}

// Müşteri kaydını siler (yalnızca sahip). Randevu geçmişi korunur.
export async function DELETE(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId, phone } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "manage_customer_records");
    await deleteCustomerRecord(db, tenantId, phone, userId);
    return Response.json({ ok: true });
  });
}
