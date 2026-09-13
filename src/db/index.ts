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

function sslFor(url: string): false | { rejectUnauthorized: false } {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const sslMode = parsed.searchParams.get("sslmode");
    if (host === "localhost" || host === "127.0.0.1") return false;
    if (sslMode === "disable") return false;
    // Hosted Postgres (Render, Supabase, Neon) needs TLS.
    if (
      host.endsWith(".render.com") ||
      host.endsWith(".supabase.co") ||
      host.endsWith(".supabase.com") ||
      host.endsWith(".neon.tech") ||
      sslMode === "require"
    ) {
      return { rejectUnauthorized: false };
    }
    return false;
  } catch {
    return false;
  }
}

export function getSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and start Postgres.",
    );
  }
  if (!globalForDb.claimsSql) {
    // Supabase session pooler caps clients at 15. Vercel keeps lambdas warm,
    // so each instance must release its slots when idle or the pooler starves.
    globalForDb.claimsSql = postgres(url, {
      max: 3,
      idle_timeout: 20,
      max_lifetime: 60 * 5,
      ssl: sslFor(url),
    });
  }
  return globalForDb.claimsSql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

export type Database = ReturnType<typeof getDb>;
