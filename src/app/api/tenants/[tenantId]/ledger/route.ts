import { getDb } from "@/lib/db";
import { readJson, requireMember, route } from "@/lib/http";
import { addLedgerEntry, listLedger, type Donem, type Sekme } from "@/lib/ledger";
import { assertCan } from "@/lib/permissions";

type Ctx = { params: Promise<{ tenantId: string }> };

// Kasa listesi ve özet. Yalnızca sahip.
export async function GET(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { role } = await requireMember(db, req, tenantId);
    assertCan(role, "view_ledger");
    const sp = new URL(req.url).searchParams;
    const view = await listLedger(db, tenantId, {
      sekme: (sp.get("sekme") ?? "tumu") as Sekme,
      donem: (sp.get("donem") ?? "bugun") as Donem,
      category: sp.get("kategori") ?? undefined,
      q: sp.get("q") ?? undefined,
      personelId: sp.get("personel") ?? undefined,
    });
    return Response.json(view);
  });
}

// Manuel gelir veya gider kaydı.
export async function POST(req: Request, ctx: Ctx) {
  return route(async () => {
    const { tenantId } = await ctx.params;
    const db = getDb();
    const { userId, role } = await requireMember(db, req, tenantId);
    assertCan(role, "view_ledger");
    const id = await addLedgerEntry(db, tenantId, await readJson(req), userId);
    return Response.json({ ok: true, id }, { status: 201 });
  });
}
