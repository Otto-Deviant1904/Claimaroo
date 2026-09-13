import { ClaimsInbox } from "@/components/claims/inbox";
import { listInboxClaims } from "@/lib/claim-list";

export const dynamic = "force-dynamic";

function isConnRefused(error: unknown) {
  const err = error as { code?: string; cause?: { code?: string } };
  return err?.code === "ECONNREFUSED" || err?.cause?.code === "ECONNREFUSED";
}

export default async function ClaimsPage() {
  try {
    const claims = await listInboxClaims();
    return <ClaimsInbox claims={claims} error={null} />;
  } catch (error) {
    const message = isConnRefused(error)
      ? "Postgres is not running. Start Docker and run `docker compose up -d`."
      : error instanceof Error
        ? error.message
        : "Database unavailable";
    return <ClaimsInbox claims={[]} error={message} />;
  }
}
