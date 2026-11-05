import { Pool } from "pg";

// Minimal database abstraction so the same service code runs on PostgreSQL
// (production, via `pg`) and on PGlite (tests, real Postgres engine in WASM).

export interface Queryable {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

export interface Db {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
}

let pool: Pool | undefined;

// DATABASE_APP_ROLE: a restricted role (not the table owner) that every
// transaction switches into with SET LOCAL ROLE, so RLS applies even when the
// connection user is privileged.
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tanımlı değil");
  pool ??= new Pool({ connectionString: url, max: 10 });
  const role = process.env.DATABASE_APP_ROLE;
  if (role && !/^[a-z_][a-z0-9_]{0,62}$/.test(role)) throw new Error("DATABASE_APP_ROLE geçersiz");
  return poolDb(pool, role || undefined);
}

export function poolDb(p: Pool, appRole?: string): Db {
  return {
    async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        if (appRole) await client.query(`SET LOCAL ROLE ${appRole}`);
        const tx: Queryable = {
          async query<R = Record<string, unknown>>(sql: string, params?: unknown[]) {
            const res = await client.query(sql, params);
            return { rows: res.rows as R[] };
          },
        };
        const out = await fn(tx);
        await client.query("COMMIT");
        return out;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
    async exec(sql: string) {
      await p.query(sql);
    },
  };
}

// Runs fn inside a transaction whose RLS tenant context is set. set_config with
// is_local=true lasts only for this transaction, so pooled connections do not leak it.
export function withTenant<T>(db: Db, tenantId: string, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    return fn(tx);
  });
}
