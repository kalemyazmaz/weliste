import { confirmPasswordReset } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security";

export async function POST(req: Request) {
  return route(async () => {
    assertSameOrigin(req);
    const body = (await readJson(req)) as { token?: unknown; password?: unknown } | null;
    await confirmPasswordReset(getDb(), body?.token, body?.password);
    return Response.json({ ok: true });
  });
}
