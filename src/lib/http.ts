import { currentUser, membershipRole } from "./auth";
import { Db } from "./db";
import { AppError } from "./errors";
import { assertSameOrigin } from "./security";

export const SESSION_COOKIE = "org_session";
const COOKIE_MAX_AGE = 14 * 24 * 60 * 60;

export function readToken(req: Request): string | null {
  const header = req.headers.get("cookie") ?? "";
  const m = header.match(/(?:^|;\s*)org_session=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// Authenticates the caller and confirms membership of the requested tenant.
// Authorization is checked here, before any tenant-scoped query runs.
export async function requireMember(db: Db, req: Request, tenantId: string): Promise<{ userId: string; role: string }> {
  assertSameOrigin(req);
  const token = readToken(req);
  if (!token) throw new AppError(401, "unauthenticated");
  const user = await currentUser(db, token);
  if (!user) throw new AppError(401, "unauthenticated");
  const role = await membershipRole(db, user.id, tenantId);
  if (!role) throw new AppError(403, "forbidden");
  return { userId: user.id, role };
}

// Secure bayrağı yalnızca istek gerçekten HTTPS ise eklenir. Aksi halde tarayıcı (özellikle
// http://localhost veya yerel ağ adresi üzerinden) çerezi kabul etmez ve oturum açılmaz.
export function isHttpsRequest(req: Request): boolean {
  if (new URL(req.url).protocol === "https:") return true;
  return (req.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
}

export function sessionCookie(token: string, secure: boolean): string {
  const flag = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${flag}`;
}

export function clearCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ error: err.code, fields: err.fields }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "internal" }, { status: 500 });
}

export async function route(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    return errorResponse(err);
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError(400, "invalid_json");
  }
}

// Yalnızca oturum kontrolü (üyelik gerektirmez). Kullanıcı ve oturum jetonunu döndürür.
export async function requireSession(db: Db, req: Request): Promise<{ userId: string; token: string }> {
  assertSameOrigin(req);
  const token = readToken(req);
  if (!token) throw new AppError(401, "unauthenticated");
  const user = await currentUser(db, token);
  if (!user) throw new AppError(401, "unauthenticated");
  return { userId: user.id, token };
}
