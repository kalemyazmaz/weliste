// Temiz veritabanı kurulumu (ör. Neon, yeni bir PostgreSQL). Test hesabı veya veri yüklemez.
// Kullanım (proje kökünden, DATABASE_APP_ROLE tanımlamadan):
//   DATABASE_URL=postgres://... ADMIN_EMAIL=siz@ornek.com npx tsx scripts/bootstrap-db.ts
// Adımlar: şema uygulanır; organiza_app rolü yoksa oluşturulur ve bağlantı kullanıcısına verilir;
// ADMIN_EMAIL verilmişse o kullanıcı yönetici yapılır (kullanıcı önce sitede kayıt olmuş olmalı).
import { applySchema } from "../src/db/migrate";
import { getDb } from "../src/lib/db";

async function main() {
  if (process.env.DATABASE_APP_ROLE) throw new Error("Kurulum DATABASE_APP_ROLE olmadan çalıştırılmalı.");
  const db = getDb();
  await applySchema(db);
  await db.transaction(async (tx) => {
    await tx.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'organiza_app') THEN CREATE ROLE organiza_app NOLOGIN; END IF; END $$`);
    await tx.query(`GRANT organiza_app TO CURRENT_USER`);
    await tx.query(`GRANT USAGE ON SCHEMA public TO organiza_app`);
    await tx.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO organiza_app`);
    await tx.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO organiza_app`);
  });
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (email) {
    const r = await db.transaction((tx) => tx.query<{ id: string }>("UPDATE users SET is_admin = true WHERE email = $1 RETURNING id", [email]));
    if (!r.rows.length) console.log(`Uyarı: ${email} bulunamadı. Önce sitede bu e-posta ile kayıt olun, sonra betiği tekrar çalıştırın.`);
    else console.log(`${email} yönetici yapıldı.`);
  }
  const t = await db.transaction((tx) => tx.query<{ n: number }>("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'"));
  console.log(`Kurulum tamam: ${t.rows[0].n} tablo hazır.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
