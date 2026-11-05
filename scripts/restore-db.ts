// Veritabanı geri yükleme: yedek dökümünü (veritabani/*.jsonl + _manifest.json) boş bir veritabanına yükler.
// Kullanım (proje kökünden, DATABASE_APP_ROLE tanımlamadan, süper kullanıcı bağlantısıyla):
//   DATABASE_URL=postgres://postgres@localhost:5432/hedef npx tsx scripts/restore-db.ts <yedek-klasoru>/veritabani
// Akış: şema kurulur, tüm tablolar boşaltılır, her JSON satırı ilgili tabloya yazılır, satır sayıları manifestle karşılaştırılır.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db";
import { applySchema } from "../src/db/migrate";

// Tabloları yabancı anahtar bağımlılığına göre sıralar (üst tablo önce). Döngü varsa hata verir.
async function insertOrder(db: ReturnType<typeof getDb>, tables: string[]): Promise<string[]> {
  const r = await db.transaction((tx) =>
    tx.query<{ child: string; parent: string }>(
      `SELECT c.relname AS child, p.relname AS parent FROM pg_constraint k
       JOIN pg_class c ON c.oid = k.conrelid JOIN pg_class p ON p.oid = k.confrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace WHERE k.contype = 'f' AND n.nspname = 'public'`,
    ),
  );
  const deps = new Map<string, Set<string>>(tables.map((t) => [t, new Set()]));
  for (const e of r.rows) if (e.child !== e.parent && deps.has(e.child) && deps.has(e.parent)) deps.get(e.child)!.add(e.parent);
  const done: string[] = [];
  const left = new Set(tables);
  while (left.size) {
    const ready = [...left].filter((t) => [...deps.get(t)!].every((p) => !left.has(p)));
    if (!ready.length) throw new Error("Yabancı anahtar döngüsü var; geri yükleme sırası belirlenemedi.");
    for (const t of ready.sort()) { done.push(t); left.delete(t); }
  }
  return done;
}

async function main() {
  const dir = process.argv[2];
  if (!dir || !existsSync(path.join(dir, "_manifest.json"))) {
    throw new Error("Yedek klasörü bulunamadı veya _manifest.json yok. Kullanım: restore-db.ts <yedek>/veritabani");
  }
  if (process.env.DATABASE_APP_ROLE) throw new Error("Geri yükleme DATABASE_APP_ROLE olmadan (süper kullanıcı ile) çalıştırılmalı.");
  const manifest = JSON.parse(readFileSync(path.join(dir, "_manifest.json"), "utf8")) as { tablolar: Record<string, number> };
  const tables = Object.keys(manifest.tablolar);
  const files = new Set(readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => f.slice(0, -6)));
  const missing = tables.filter((t) => !files.has(t));
  if (missing.length) throw new Error(`Manifestteki tablo dosyaları eksik: ${missing.join(", ")}`);

  const db = getDb();
  await applySchema(db);
  // Tüm tabloları tek işlemde boşalt ve yükle. Yabancı anahtar kontrolü geçici kapatılır.
  // Yabancı anahtar sırası: üst tablolar önce yüklenir. Süper kullanıcı gerektirmez (Neon uyumlu).
  const order = await insertOrder(db, tables);
  await db.transaction(async (tx) => {
    await tx.query(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`);
    for (const t of order) {
      const lines = readFileSync(path.join(dir, `${t}.jsonl`), "utf8").split("\n").filter((l) => l.trim() !== "");
      for (const line of lines) {
        await tx.query(`INSERT INTO "${t}" SELECT * FROM json_populate_record(NULL::"${t}", $1::json)`, [line]);
      }
    }
  });

  // Doğrulama: her tablonun satır sayısı manifestle eşleşmeli.
  const bad: string[] = [];
  for (const t of tables) {
    const r = await db.transaction((tx) => tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${t}"`));
    if (Number(r.rows[0].n) !== manifest.tablolar[t]) bad.push(`${t}: beklenen ${manifest.tablolar[t]}, bulunan ${r.rows[0].n}`);
  }
  if (bad.length) throw new Error(`Satır sayısı uyuşmuyor:\n${bad.join("\n")}`);
  console.log(`Geri yükleme tamam: ${tables.length} tablo, ${Object.values(manifest.tablolar).reduce((a, b) => a + b, 0)} satır doğrulandı.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
