import { signup } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isHttpsRequest, readJson, route, sessionCookie } from "@/lib/http";
import { assertSameOrigin, clientIp } from "@/lib/security";

export async function POST(req: Request) {
  return route(async () => {
    assertSameOrigin(req);
    const body = (await readJson(req)) as Record<string, unknown> | null;
    const { token, tenantId } = await signup(getDb(), {
      email: body?.email,
      password: body?.password,
      tenantName: body?.tenantName,
      city: body?.city,
      sector: body?.sector,
    }, clientIp(req));
    return Response.json({ ok: true, tenantId }, { status: 201, headers: { "Set-Cookie": sessionCookie(token, isHttpsRequest(req)) } });
  });
}
