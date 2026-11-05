import { createHash } from "node:crypto";
import { Db } from "./db";
import { AppError } from "./errors";

// Brute-force protection. Keys are hashes of the email / IP, so no raw identifiers
// are stored in login_attempts. A key locks after MAX_FAILS within WINDOW_MIN minutes.
const WINDOW_MIN = 15;
const MAX_FAILS = 5;
const LOCK_MIN = 15;

export function keyHash(prefix: string, value: string): string {
  return `${prefix}:${createHash("sha256").update(value.trim().toLowerCase()).digest("hex")}`;
}

// Client IP is trusted ONLY when TRUST_PROXY=1 (the app sits behind a proxy that sets the header).
// Otherwise the header is attacker-controlled, so no IP bucket is used at all; per-account
// throttling still applies. Returning a shared fallback would let one client lock out everyone.
export function clientIp(req: Request): string | null {
  if (process.env.TRUST_PROXY !== "1") return null;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export function ipKeys(prefix: string, ip: string | null): string[] {
  return ip ? [keyHash(prefix, ip)] : [];
}

export async function assertNotLocked(db: Db, keys: string[]): Promise<void> {
  const res = await db.transaction((tx) =>
    tx.query("SELECT key FROM login_attempts WHERE key = ANY($1::text[]) AND locked_until > now() LIMIT 1", [keys]),
  );
  if (res.rows.length) throw new AppError(429, "too_many_attempts");
}

export async function recordFailure(db: Db, keys: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const key of keys) {
      await tx.query(
        `INSERT INTO login_attempts (key, failures, window_start) VALUES ($1, 1, now())
         ON CONFLICT (key) DO UPDATE SET
           failures = CASE WHEN login_attempts.window_start < now() - make_interval(mins => $2::int)
                           THEN 1 ELSE login_attempts.failures + 1 END,
           window_start = CASE WHEN login_attempts.window_start < now() - make_interval(mins => $2::int)
                               THEN now() ELSE login_attempts.window_start END,
           locked_until = CASE WHEN (CASE WHEN login_attempts.window_start < now() - make_interval(mins => $2::int)
                                          THEN 1 ELSE login_attempts.failures + 1 END) >= $3::int
                               THEN now() + make_interval(mins => $4::int)
                               ELSE login_attempts.locked_until END`,
        [key, WINDOW_MIN, MAX_FAILS, LOCK_MIN],
      );
    }
  });
}

export async function clearFailures(db: Db, keys: string[]): Promise<void> {
  await db.transaction((tx) => tx.query("DELETE FROM login_attempts WHERE key = ANY($1::text[])", [keys]));
}

// CSRF defense in depth. The session cookie is SameSite=Lax, and every mutating
// request must (a) be JSON, which a cross-site HTML form cannot send, and
// (b) carry an Origin header, when present, that matches the Host.
export function assertSameOrigin(req: Request): void {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (!host || originHost !== host) throw new AppError(403, "bad_origin");
  }
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("application/json")) throw new AppError(415, "unsupported_media_type");
}
