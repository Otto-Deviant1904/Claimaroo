import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

config({ path: ".env.local" });
config({ path: ".env" });

type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as {
  claimsSql?: Sql;
};

export function getSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and start Postgres.",
    );
  }
  if (!globalForDb.claimsSql) {
    globalForDb.claimsSql = postgres(url, { max: 5 });
  }
  return globalForDb.claimsSql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

export type Database = ReturnType<typeof getDb>;
