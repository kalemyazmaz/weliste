// Geliştirme tohumu (randevu ürünü). Gerekli: DATABASE_URL, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD.
// Parola yazdırılmaz ve depoda saklanmaz.
import { createUser } from "../src/lib/auth";
import { getDb } from "../src/lib/db";
import { applySchema } from "../src/db/migrate";
import { addService, addStaff, saveProfile } from "../src/lib/workspace";

async function main() {
  const email = process.env.SEED_OWNER_EMAIL;
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!email || !password) throw new Error("SEED_OWNER_EMAIL ve SEED_OWNER_PASSWORD gerekli");

  const db = getDb();
  await applySchema(db);

  const tenantId = "t-demo-randevu";
  await db.transaction((tx) =>
    tx.query(
      `INSERT INTO tenants (id, name, city, plan, sector) VALUES ($1, 'Örnek Güzellik Salonu', 'Şanlıurfa', 'pro', 'guzellik-salonu')
       ON CONFLICT (id) DO NOTHING`,
      [tenantId],
    ),
  );

  const userId = await createUser(db, email, password);
  await db.transaction((tx) =>
    tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT (tenant_id, user_id) DO NOTHING`,
      [tenantId, userId],
    ),
  );

  // Tekrar çalıştırmada kayıtları çoğaltmamak için yalnızca hizmet yoksa ekle.
  const existing = await db.transaction((tx) => tx.query<{ n: string }>("SELECT count(*)::text AS n FROM services WHERE tenant_id = $1", [tenantId]));
  if (existing.rows[0].n === "0") {
    await addService(db, tenantId, { name: "Cilt bakımı", priceTl: 750, durationMin: 60 }, userId);
    await addService(db, tenantId, { name: "Makyaj", priceTl: 500, durationMin: 45 }, userId);
    await addStaff(db, tenantId, { name: "Derya Öz", role: "Estetisyen" }, userId);
    await saveProfile(db, tenantId, { description: "Cilt bakımı ve makyaj hizmetleri.", phone: "05320000000", published: true }, userId);
  }
  console.log("Tohum tamamlandı:", tenantId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
