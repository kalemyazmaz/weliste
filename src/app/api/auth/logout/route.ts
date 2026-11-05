import { logout } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { clearCookie, readToken, route } from "@/lib/http";

export async function POST(req: Request) {
  return route(async () => {
    const token = readToken(req);
    if (token) await logout(getDb(), token);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookie() } });
  });
}
