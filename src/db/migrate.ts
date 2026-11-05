import { readFileSync } from "node:fs";
import path from "node:path";
import { Db } from "../lib/db";

// Applies the idempotent schema. Run from the project root.
export async function applySchema(db: Db): Promise<void> {
  const sql = readFileSync(path.join(process.cwd(), "src/db/schema.sql"), "utf8");
  await db.exec(sql);
}
