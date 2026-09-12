import { NextResponse } from "next/server";
import { loadCasePack } from "@/lib/tools";
import { corsPreflight, withCors } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const pack = await loadCasePack(id);
    return withCors(NextResponse.json({
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
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found";
    const status = message.includes("not found") ? 404 : 503;
    return withCors(NextResponse.json({ error: message }, { status }));
  }
}
