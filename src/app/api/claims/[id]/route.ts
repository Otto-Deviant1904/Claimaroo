import { NextResponse } from "next/server";
import { loadCasePack } from "@/lib/tools";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const pack = await loadCasePack(id);
    return NextResponse.json({
      claim: pack.claim,
      customer: pack.customer,
      policy: pack.policy,
      evidence: pack.evidenceRows.map((row) => ({
        ...row,
        bytes: undefined,
        hasFile: Boolean(row.bytes),
      })),
      assessment: pack.assessment,
      audit: pack.audit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found";
    const status = message.includes("not found") ? 404 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
