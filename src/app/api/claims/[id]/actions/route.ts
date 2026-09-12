import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { executeTool } from "@/lib/tools";
import { corsPreflight, withCors } from "@/lib/cors";

const ACTIONS = [
  "approve_next_stage",
  "request_information",
  "escalate",
  "override",
] as const;

type Action = (typeof ACTIONS)[number];

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    action?: string;
    note?: string;
    status?: string;
    route?: string;
  };
  const action = body.action as Action | undefined;
  if (!action || !ACTIONS.includes(action)) {
    return withCors(NextResponse.json({ error: "Unknown action" }, { status: 400 }));
  }

  const db = getDb();
  const note = body.note?.trim() || null;

  if (action === "escalate") {
    const result = await executeTool(
      "escalate_claim",
      { claim_id: id, reason: note ?? "Officer escalated" },
      { actor: "officer" },
    );
    return withCors(NextResponse.json({ ok: true, result }));
  }

  const patch: Record<string, unknown> = {
    updatedAt: new Date(),
    officerNotes: note,
  };

  if (action === "approve_next_stage") {
    patch.status = "approved_next_stage";
    patch.recommendedAction =
      "Officer approved the next stage. Still not a binding settlement.";
  } else if (action === "request_information") {
    patch.status = "info_requested";
    patch.recommendedAction = note
      ? `Information requested: ${note}`
      : "Information requested from the customer.";
  } else if (action === "override") {
    if (body.status) patch.status = body.status;
    if (body.route) patch.route = body.route;
  }

  await db
    .update(claims)
    .set(patch)
    .where(eq(claims.id, id));

  await recordAudit({
    claimId: id,
    actor: "officer",
    action: `officer:${action}`,
    inputs: body,
    result: patch,
  });

  return withCors(NextResponse.json({ ok: true, action, claimId: id }));
}
