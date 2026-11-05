import { changePassword, hashToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { readJson, readToken, requireSession, route } from "@/lib/http";

// Parola değişikliği: { currentPassword, newPassword }. Diğer oturumlar kapatılır.
export async function POST(req: Request) {
  return route(async () => {
    const db = getDb();
    const { userId, token } = await requireSession(db, req);
    const body = (await readJson(req)) as { currentPassword?: unknown; newPassword?: unknown } | null;
    await changePassword(db, userId, body?.currentPassword, body?.newPassword, hashToken(token));
    return Response.json({ ok: true });
  });
}
