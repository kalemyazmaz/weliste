import { login } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { isHttpsRequest, readJson, route, sessionCookie } from "@/lib/http";
import { assertSameOrigin, clientIp } from "@/lib/security";

export async function POST(req: Request) {
  return route(async () => {
    assertSameOrigin(req);
    const body = (await readJson(req)) as { email?: unknown; password?: unknown } | null;
    if (typeof body?.email !== "string" || typeof body?.password !== "string" || body.password.length < 1) {
      throw new AppError(422, "validation", ["email", "password"]);
    }
    const { token } = await login(getDb(), body.email, body.password, clientIp(req));
    return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(token, isHttpsRequest(req)) } });
  });
}
