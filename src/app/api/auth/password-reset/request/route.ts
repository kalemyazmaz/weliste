import { requestPasswordReset } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { assertNotLocked, assertSameOrigin, clientIp, ipKeys, recordFailure } from "@/lib/security";

// Always 202, whether or not the email exists.
export async function POST(req: Request) {
  return route(async () => {
    assertSameOrigin(req);
    const db = getDb();
    const keys = ipKeys("reset-ip", clientIp(req));
    await assertNotLocked(db, keys);
    await recordFailure(db, keys);
    const body = (await readJson(req)) as { email?: unknown } | null;
    const origin = new URL(req.url).origin;
    await requestPasswordReset(db, body?.email, origin);
    return Response.json({ ok: true }, { status: 202 });
  });
}
