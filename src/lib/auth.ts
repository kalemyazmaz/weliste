import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Db } from "./db";
import { AppError } from "./errors";
import { queueEmail } from "./mailer";
import { isSectorKey } from "./sectors";
import { assertNotLocked, clearFailures, ipKeys, keyHash, recordFailure } from "./security";

const scryptAsync = promisify(scryptCb) as unknown as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export const SESSION_DAYS = 14;
const RESET_MINUTES = 60;
const MIN_PASSWORD = 10;
const MAX_PASSWORD = 200;
const DUMMY_HASH = "scrypt:AAAAAAAAAAAAAAAAAAAAAA==:AAAA";

export function validatePassword(password: unknown): string {
  if (typeof password !== "string" || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    throw new AppError(422, "validation", ["password"]);
  }
  return password;
}

export function validateEmail(email: unknown): string {
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new AppError(422, "validation", ["email"]);
  return e;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return ["scrypt", salt.toString("base64"), key.toString("base64")].join(":");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltB64, keyB64] = stored.split(":");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(expected, actual);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function createSession(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.transaction((tx) =>
    tx.query(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3::int))",
      [hashToken(token), userId, SESSION_DAYS],
    ),
  );
  return token;
}

// Login with brute-force protection: both the email and the client IP are counted.
export async function login(
  db: Db,
  email: string,
  password: string,
  ip: string | null = null,
): Promise<{ token: string; userId: string }> {
  const normalized = email.trim().toLowerCase();
  const emailKey = keyHash("email", normalized);
  const keys = [emailKey, ...ipKeys("ip", ip)];
  await assertNotLocked(db, keys);

  const res = await db.transaction((tx) =>
    tx.query<{ id: string; password_hash: string; disabled: boolean }>("SELECT id, password_hash, disabled FROM users WHERE email = $1", [normalized]),
  );
  const user = res.rows[0];
  // Verify even when the user is missing, so response time does not reveal which emails exist.
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
    await recordFailure(db, keys);
    throw new AppError(401, "invalid_credentials");
  }
  if (user.disabled) throw new AppError(403, "account_disabled");
  await clearFailures(db, [emailKey]);
  return { token: await createSession(db, user.id), userId: user.id };
}

// Creates a user and a new tenant with the user as owner, then starts a session.
export async function signup(
  db: Db,
  input: { email: unknown; password: unknown; tenantName: unknown; city: unknown; sector?: unknown },
  ip: string | null = null,
): Promise<{ token: string; userId: string; tenantId: string }> {
  const keys = ipKeys("signup-ip", ip);
  await assertNotLocked(db, keys);
  await recordFailure(db, keys); // every attempt counts when the IP is trusted

  const email = validateEmail(input.email);
  const password = validatePassword(input.password);
  const tenantName = typeof input.tenantName === "string" ? input.tenantName.trim() : "";
  const city = typeof input.city === "string" ? input.city.trim() : "";
  const bad: string[] = [];
  if (tenantName.length < 2 || tenantName.length > 120) bad.push("tenantName");
  if (city.length < 2 || city.length > 60) bad.push("city");
  // Randevu sektörü verilirse işletme 'randevu' türünde kaydedilir ve düğün türü dikkate alınmaz.
  // Randevu sektörü zorunludur; geçerli bir anahtar olmalıdır.
  const sector = typeof input.sector === "string" && isSectorKey(input.sector) ? input.sector : null;
  if (sector === null) bad.push("sector");
  if (bad.length) throw new AppError(422, "validation", bad);

  const userId = randomUUID();
  const tenantId = `t-${randomUUID().slice(0, 8)}`;
  const hash = await hashPassword(password);
  try {
    await db.transaction(async (tx) => {
      await tx.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)", [userId, email, hash]);
      await tx.query(
        "INSERT INTO tenants (id, name, city, plan, sector) VALUES ($1, $2, $3, 'starter', $4)",
        [tenantId, tenantName, city, sector],
      );
      await tx.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')", [tenantId, userId]);
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new AppError(409, "email_taken");
    throw err;
  }
  return { token: await createSession(db, userId), userId, tenantId };
}

// Always returns normally, so the response does not reveal whether the email exists.
export async function requestPasswordReset(db: Db, email: unknown, origin: string): Promise<void> {
  if (typeof email !== "string") return;
  const normalized = email.trim().toLowerCase();
  const res = await db.transaction((tx) => tx.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [normalized]));
  const user = res.rows[0];
  if (!user) return;

  const token = randomBytes(32).toString("base64url");
  await db.transaction((tx) =>
    tx.query(
      "INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3::int))",
      [hashToken(token), user.id, RESET_MINUTES],
    ),
  );
  const link = `${origin}/giris/sifre-sifirla?token=${token}`;
  await queueEmail(
    db,
    normalized,
    "Parola sıfırlama",
    `Parolanızı sıfırlamak için bağlantı (${RESET_MINUTES} dakika geçerli):\n${link}\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayın.`,
  );
}

// Single-use token. On success every existing session of the user is revoked.
export async function confirmPasswordReset(db: Db, token: unknown, password: unknown): Promise<void> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) {
    throw new AppError(422, "invalid_token");
  }
  const pw = validatePassword(password);
  const hash = await hashPassword(pw);
  await db.transaction(async (tx) => {
    const res = await tx.query<{ user_id: string }>(
      `SELECT user_id FROM password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`,
      [hashToken(token)],
    );
    const row = res.rows[0];
    if (!row) throw new AppError(422, "invalid_token");
    await tx.query("UPDATE password_resets SET used_at = now() WHERE token_hash = $1", [hashToken(token)]);
    await tx.query("UPDATE users SET password_hash = $2 WHERE id = $1", [row.user_id, hash]);
    await tx.query("DELETE FROM sessions WHERE user_id = $1", [row.user_id]);
  });
}

export async function currentUser(db: Db, token: string): Promise<{ id: string; email: string; isAdmin: boolean } | null> {
  // Devre dışı bırakılan kullanıcının oturumu geçersiz sayılır.
  const res = await db.transaction((tx) =>
    tx.query<{ id: string; email: string; is_admin: boolean }>(
      `SELECT u.id, u.email, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT u.disabled`,
      [hashToken(token)],
    ),
  );
  const r = res.rows[0];
  return r ? { id: r.id, email: r.email, isAdmin: r.is_admin } : null;
}

export async function logout(db: Db, token: string): Promise<void> {
  await db.transaction((tx) => tx.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]));
}

export async function membershipRole(db: Db, userId: string, tenantId: string): Promise<string | null> {
  const res = await db.transaction((tx) =>
    tx.query<{ role: string }>("SELECT role FROM memberships WHERE user_id = $1 AND tenant_id = $2", [userId, tenantId]),
  );
  return res.rows[0]?.role ?? null;
}

export async function createUser(db: Db, email: string, password: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const id = randomUUID();
  const hash = await hashPassword(password);
  const res = await db.transaction((tx) =>
    tx.query<{ id: string }>(
      `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [id, normalized, hash],
    ),
  );
  return res.rows[0].id;
}

// Oturum açmış kullanıcı parolasını değiştirir. Mevcut parola doğrulanır; diğer oturumlar kapatılır.
export async function changePassword(db: Db, userId: string, currentPassword: unknown, newPassword: unknown, keepTokenHash: string): Promise<void> {
  if (typeof currentPassword !== "string" || currentPassword.length === 0) throw new AppError(422, "validation", ["currentPassword"]);
  const next = validatePassword(newPassword);
  const res = await db.transaction((tx) => tx.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [userId]));
  const row = res.rows[0];
  if (!row || !(await verifyPassword(currentPassword, row.password_hash))) throw new AppError(422, "validation", ["currentPassword"]);
  const hash = await hashPassword(next);
  await db.transaction(async (tx) => {
    await tx.query("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, hash]);
    await tx.query("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", [userId, keepTokenHash]);
  });
}
