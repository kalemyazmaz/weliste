import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { readToken, route } from "@/lib/http";
import { userTenants } from "@/lib/service";

// Returns the signed-in user and their tenants, so the login screen knows which panel to open.
export async function GET(req: Request) {
  return route(async () => {
    const token = readToken(req);
    const db = getDb();
    const user = token ? await currentUser(db, token) : null;
    if (!user) throw new AppError(401, "unauthenticated");
    return Response.json({ user: { id: user.id, email: user.email }, tenants: await userTenants(db, user.id) });
  });
}
