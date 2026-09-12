import { desc, eq } from "drizzle-orm";
import { ClaimsInbox } from "@/components/claims/inbox";
import { getDb } from "@/db";
import { claims, customers } from "@/db/schema";
import { toClaimView } from "@/lib/to-claim-view";
import { loadCasePack } from "@/lib/tools";

export const dynamic = "force-dynamic";

function isConnRefused(error: unknown) {
  const err = error as { code?: string; cause?: { code?: string } };
  return err?.code === "ECONNREFUSED" || err?.cause?.code === "ECONNREFUSED";
}

export default async function ClaimsPage() {
  try {
    const db = getDb();
    const rows = await db
      .select({ id: claims.id })
      .from(claims)
      .innerJoin(customers, eq(customers.id, claims.customerId))
      .orderBy(desc(claims.updatedAt));
    const packs = await Promise.all(rows.map((row) => loadCasePack(row.id)));
    return <ClaimsInbox claims={packs.map(toClaimView)} error={null} />;
  } catch (error) {
    const message = isConnRefused(error)
      ? "Postgres is not running. Start Docker and run `docker compose up -d`."
      : error instanceof Error
        ? error.message
        : "Database unavailable";
    return <ClaimsInbox claims={[]} error={message} />;
  }
}
