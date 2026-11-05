import { currentUser as currentUserDb } from "./auth";
import { getDb } from "./db";
import { userTenants } from "./service";

// Server-component helpers that open their own database handle.
export async function currentUser(token: string) {
  return currentUserDb(getDb(), token);
}

export async function userTenantsFor(userId: string) {
  return userTenants(getDb(), userId);
}
