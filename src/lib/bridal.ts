import { randomUUID } from "node:crypto";
import { Db, withTenant } from "./db";
import { AppError } from "./errors";
import { audit } from "./service";
import { requireVenueModule } from "./venue";

// Saç ve makyaj: gelin dosyaları. Durum: planlandı → deneme yapıldı → gelin günü → tamamlandı (ya da iptal).
import { BRIDAL_STATUSES, type BridalStatus } from "./bridal-catalog";
export { BRIDAL_STATUSES };
export type { BridalStatus };
export interface BridalFile { id: string; brideName: string; phone: string; weddingDate: string | null; trialDate: string | null; package: string; status: BridalStatus; note: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function optDate(v: unknown): string | null | undefined {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || !DATE.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? undefined : v;
}

export async function listBridalFiles(db: Db, tenantId: string): Promise<BridalFile[]> {
  await requireVenueModule(db, tenantId, "bridal_files");
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query<Record<string, unknown>>("SELECT id, bride_name, phone, wedding_date::text AS w, trial_date::text AS t, package, status, note FROM bridal_files ORDER BY COALESCE(wedding_date, '9999-12-31'), created_at");
    return r.rows.map((x) => ({
      id: String(x.id), brideName: String(x.bride_name), phone: String(x.phone), weddingDate: x.w ? String(x.w) : null,
      trialDate: x.t ? String(x.t) : null, package: String(x.package), status: x.status as BridalStatus, note: String(x.note),
    }));
  });
}

export async function saveBridalFile(db: Db, tenantId: string, id: string | null, raw: unknown, actor?: string): Promise<void> {
  await requireVenueModule(db, tenantId, "bridal_files");
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = typeof b.brideName === "string" ? b.brideName.trim().slice(0, 120) : undefined;
  const phone = typeof b.phone === "string" ? b.phone.replace(/[^\d+]/g, "").slice(0, 20) : undefined;
  const wedding = "weddingDate" in b ? optDate(b.weddingDate) : undefined;
  const trial = "trialDate" in b ? optDate(b.trialDate) : undefined;
  const pkg = typeof b.package === "string" ? b.package.trim().slice(0, 120) : undefined;
  const status = typeof b.status === "string" && (BRIDAL_STATUSES as readonly string[]).includes(b.status) ? b.status : undefined;
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 1000) : undefined;
  const bad: string[] = [];
  if (id === null && (!name || name.length < 2)) bad.push("brideName");
  if (name !== undefined && name.length < 2) bad.push("brideName");
  if ("weddingDate" in b && wedding === undefined) bad.push("weddingDate");
  if ("trialDate" in b && trial === undefined) bad.push("trialDate");
  if ("status" in b && status === undefined) bad.push("status");
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    if (id === null) {
      const newId = randomUUID();
      await tx.query("INSERT INTO bridal_files (id, tenant_id, bride_name, phone, wedding_date, trial_date, package, status, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [newId, tenantId, name, phone ?? "", wedding ?? null, trial ?? null, pkg ?? "", status ?? "planlandi", note ?? ""]);
      await audit(tx, tenantId, actor, "bridal.create", newId, {});
      return;
    }
    const r = await tx.query(
      `UPDATE bridal_files SET bride_name = COALESCE($2, bride_name), phone = COALESCE($3, phone),
         wedding_date = CASE WHEN $4 THEN $5::date ELSE wedding_date END, trial_date = CASE WHEN $6 THEN $7::date ELSE trial_date END,
         package = COALESCE($8, package), status = COALESCE($9, status), note = COALESCE($10, note)
       WHERE id = $1 RETURNING id`,
      [id, name ?? null, phone ?? null, "weddingDate" in b, wedding ?? null, "trialDate" in b, trial ?? null, pkg ?? null, status ?? null, note ?? null],
    );
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "bridal.update", id, { status: status ?? null });
  });
}

export async function deleteBridalFile(db: Db, tenantId: string, id: string, actor?: string): Promise<void> {
  await requireVenueModule(db, tenantId, "bridal_files");
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("DELETE FROM bridal_files WHERE id = $1 RETURNING id", [id]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "bridal.delete", id, {});
  });
}
