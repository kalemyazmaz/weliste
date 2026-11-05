import { randomUUID } from "node:crypto";
import { Db, withTenant } from "./db";
import { AppError } from "./errors";
import { audit } from "./service";

// Ürün kataloğu: kasada gelir kalemi olarak seçilir.
export interface ProductRow { id: string; name: string; priceTl: number }

export async function listProducts(db: Db, tenantId: string): Promise<ProductRow[]> {
  return withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("SELECT id, name, price_tl::text AS price FROM products ORDER BY created_at");
    return r.rows.map((x) => ({ id: String(x.id), name: String(x.name), priceTl: Number(x.price) }));
  });
}

export async function addProduct(db: Db, tenantId: string, raw: unknown, actor?: string): Promise<void> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  const price = Number(b.priceTl ?? 0);
  const bad: string[] = [];
  if (name.length < 2) bad.push("name");
  if (!Number.isFinite(price) || price < 0 || price > 1e9) bad.push("priceTl");
  if (bad.length) throw new AppError(422, "validation", bad);
  await withTenant(db, tenantId, async (tx) => {
    const id = randomUUID();
    await tx.query("INSERT INTO products (id, tenant_id, name, price_tl) VALUES ($1, $2, $3, $4)", [id, tenantId, name, price]);
    await audit(tx, tenantId, actor, "product.add", id, { name });
  });
}

export async function deleteProduct(db: Db, tenantId: string, id: string, actor?: string): Promise<void> {
  await withTenant(db, tenantId, async (tx) => {
    const r = await tx.query("DELETE FROM products WHERE id = $1 RETURNING name", [id]);
    if (!r.rows.length) throw new AppError(404, "not_found");
    await audit(tx, tenantId, actor, "product.delete", id, { name: r.rows[0].name });
  });
}
