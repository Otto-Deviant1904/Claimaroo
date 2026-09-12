import Link from "next/link";
import { CaseView } from "@/components/claims/case-view";
import { toClaimView } from "@/lib/to-claim-view";
import { loadCasePack } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function ClaimCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const pack = await loadCasePack(id);
    return <CaseView claim={toClaimView(pack)} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claim not found";
    const missing = /not found/i.test(message);
    return (
      <main>
        <Link href="/claims" className="back-link">
          ← Claims dashboard
        </Link>
        <h1>{missing ? "Claim not found" : "Could not load claim"}</h1>
        <p>{message}</p>
      </main>
    );
  }
}
