import { Db } from "./db";
import { AppError } from "./errors";
import { DEFAULTS, SETTING_KEYS, sanitizeSetting, type SettingKey } from "./site-defaults";

// Site ayarları: tüm değerler varsayılanla birleştirilir; eksik anahtarlar varsayılanı kullanır.
export async function getSiteSettings(db: Db) {
  const r = await db.transaction((tx) => tx.query<{ key: string; value: unknown }>("SELECT key, value FROM site_settings"));
  const map = new Map(r.rows.map((x) => [x.key, x.value]));
  const out = {} as Record<SettingKey, unknown>;
  for (const k of SETTING_KEYS) {
    const bad: string[] = [];
    const stored = map.get(k);
    // Kayıtlı değer doğrulanarak okunur; geçersizse varsayılan kullanılır.
    const clean = stored ? sanitizeSetting(k, stored, bad) : null;
    out[k] = clean && bad.length === 0 ? clean : DEFAULTS[k];
  }
  return out as { home: typeof DEFAULTS.home; header: typeof DEFAULTS.header; footer: typeof DEFAULTS.footer; theme: typeof DEFAULTS.theme };
}

export async function saveSiteSetting(db: Db, key: unknown, raw: unknown): Promise<void> {
  if (typeof key !== "string" || !(SETTING_KEYS as readonly string[]).includes(key)) throw new AppError(404, "not_found");
  const bad: string[] = [];
  const value = sanitizeSetting(key as SettingKey, raw, bad);
  if (bad.length) throw new AppError(422, "validation", bad);
  await db.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
      [key, JSON.stringify(value)],
    );
  });
}
