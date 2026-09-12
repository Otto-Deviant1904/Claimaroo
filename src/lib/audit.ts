import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents } from "@/db/schema";
import { newId, summarise } from "@/lib/format";

export type AuditActor = "agent" | "officer" | "system" | "customer";

export async function recordAudit(input: {
  claimId?: string | null;
  actor: AuditActor;
  action: string;
  tool?: string | null;
  inputs?: unknown;
  result?: unknown;
}) {
  const db = getDb();
  const row = {
    id: newId("AUD"),
    claimId: input.claimId ?? null,
    actor: input.actor,
    action: input.action,
    tool: input.tool ?? null,
    inputsSummary: input.inputs == null ? null : summarise(input.inputs),
    resultSummary: input.result == null ? null : summarise(input.result),
  };
  await db.insert(auditEvents).values(row);
  return row;
}

export async function listAudit(claimId: string) {
  const db = getDb();
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.claimId, claimId));
}
