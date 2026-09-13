import { desc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  assessments,
  claims,
  customers,
  evidence,
  policies,
} from "@/db/schema";
import { analyseDamage } from "@/lib/analyse";
import { recordAudit, type AuditActor } from "@/lib/audit";
import { runCoverageCheck } from "@/lib/coverage";
import { estimateRepair } from "@/lib/estimate";
import { newId } from "@/lib/format";
import { missingRequiredFields, runTriage } from "@/lib/triage";
import type {
  StructuredFacts,
  ToolName,
} from "@/lib/types";
import { TOOL_NAMES } from "@/lib/types";

export type ToolContext = {
  actor?: AuditActor;
};

function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

export async function executeTool(
  name: string,
  rawInput: Record<string, unknown>,
  ctx: ToolContext = {},
): Promise<Record<string, unknown>> {
  if (!isToolName(name)) {
    throw new Error(`Unknown tool: ${name}`);
  }
  const actor = ctx.actor ?? "agent";
  const result = await run(name, rawInput, actor);
  const claimId =
    (typeof result.claimId === "string" && result.claimId) ||
    (typeof rawInput.claim_id === "string" && rawInput.claim_id) ||
    (typeof rawInput.claimId === "string" && rawInput.claimId) ||
    null;
  await recordAudit({
    claimId,
    actor,
    action: `tool:${name}`,
    tool: name,
    inputs: rawInput,
    result,
  });
  return result;
}

async function run(
  name: ToolName,
  input: Record<string, unknown>,
  actor: AuditActor,
): Promise<Record<string, unknown>> {
  switch (name) {
    case "get_customer":
      return getCustomer(input);
    case "get_policy":
      return getPolicy(input);
    case "create_claim":
      return createClaim(input);
    case "update_claim":
      return updateClaim(input);
    case "attach_evidence":
      return attachEvidence(input);
    case "analyse_damage":
      return analyseDamageTool(input);
    case "run_coverage_check":
      return coverageTool(input);
    case "run_triage":
      return triageTool(input);
    case "estimate_repair":
      return estimateTool(input);
    case "escalate_claim":
      return escalateTool(input, actor);
    case "generate_summary":
      return summaryTool(input);
  }
}

async function getCustomer(input: Record<string, unknown>) {
  const db = getDb();
  const id = str(input.customer_id ?? input.customerId);
  const phone = str(input.phone);
  const email = str(input.email);
  const name = str(input.name);

  const rows = await db.select().from(customers);
  const match = rows.find((c) => {
    if (id && c.id.toLowerCase() === id.toLowerCase()) return true;
    if (email && c.email.toLowerCase() === email.toLowerCase()) return true;
    if (phone && digits(c.phone) === digits(phone) && digits(phone).length >= 8)
      return true;
    if (name && c.name.toLowerCase() === name.toLowerCase()) return true;
    if (name && c.name.toLowerCase().includes(name.toLowerCase()) && name.length > 3)
      return true;
    return false;
  });

  if (!match) {
    return {
      found: false,
      message:
        "No synthetic customer matched. Ask for full name and mobile, or a policy number. Do not invent a customer.",
    };
  }

  const policyRows = await db
    .select()
    .from(policies)
    .where(eq(policies.customerId, match.id));

  return {
    found: true,
    customer: match,
    policy_ids: policyRows.map((p) => p.id),
  };
}

async function getPolicy(input: Record<string, unknown>) {
  const db = getDb();
  const policyId = str(input.policy_id ?? input.policyId);
  const customerId = str(input.customer_id ?? input.customerId);
  const registration = str(input.registration);

  let row =
    (policyId &&
      (await db.select().from(policies).where(eq(policies.id, policyId)))[0]) ||
    null;

  if (!row && customerId) {
    row =
      (
        await db
          .select()
          .from(policies)
          .where(eq(policies.customerId, customerId))
      )[0] ?? null;
  }

  if (!row && registration) {
    const all = await db.select().from(policies);
    row =
      all.find(
        (p) =>
          p.registration.replace(/\s/g, "").toLowerCase() ===
          registration.replace(/\s/g, "").toLowerCase(),
      ) ?? null;
  }

  if (!row) {
    return {
      found: false,
      message:
        "No policy matched on the source record. Do not invent coverage, excess, or dates.",
    };
  }

  return {
    found: true,
    policy: {
      id: row.id,
      customer_id: row.customerId,
      vehicle: {
        make: row.vehicleMake,
        model: row.vehicleModel,
        year: row.vehicleYear,
        registration: row.registration,
        colour: row.vehicleColour,
      },
      coverage_type: row.coverageType,
      excess_cents: row.excessCents,
      excess_aud: row.excessCents / 100,
      start_date: row.startDate,
      end_date: row.endDate,
      status: row.status,
      relevant_rules: row.relevantRules,
    },
  };
}

async function createClaim(input: Record<string, unknown>) {
  const db = getDb();
  const customerId = str(input.customer_id ?? input.customerId);
  const policyId = str(input.policy_id ?? input.policyId);
  if (!customerId || !policyId) {
    throw new Error("create_claim requires customer_id and policy_id");
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId));
  const [policy] = await db
    .select()
    .from(policies)
    .where(eq(policies.id, policyId));
  if (!customer || !policy) {
    throw new Error("create_claim: customer or policy not found on source record");
  }
  if (policy.customerId !== customer.id) {
    throw new Error("create_claim: policy does not belong to this customer");
  }

  const claimId = str(input.claim_id ?? input.claimId) || newId("CLM");
  const facts = asFacts(input.structured_facts ?? input.structuredFacts);
  const now = new Date();

  await db.insert(claims).values({
    id: claimId,
    customerId,
    policyId,
    status: "intake",
    incidentTime: str(input.incident_time ?? input.incidentTime),
    location: str(input.location),
    narrative: str(input.narrative),
    structuredFacts: facts,
    conversationId: str(input.conversation_id ?? input.conversationId),
    createdAt: now,
    updatedAt: now,
  });

  return {
    claimId,
    status: "intake",
    message: `Claim ${claimId} created and persisted.`,
  };
}

async function updateClaim(input: Record<string, unknown>) {
  const db = getDb();
  const claimId = requireClaimId(input);
  const existing = await mustClaim(claimId);
  const facts = {
    ...existing.structuredFacts,
    ...asFacts(input.structured_facts ?? input.structuredFacts),
  };
  const now = new Date();
  await db
    .update(claims)
    .set({
      incidentTime:
        str(input.incident_time ?? input.incidentTime) ?? existing.incidentTime,
      location: str(input.location) ?? existing.location,
      narrative: str(input.narrative) ?? existing.narrative,
      structuredFacts: facts,
      conversationId:
        str(input.conversation_id ?? input.conversationId) ??
        existing.conversationId,
      updatedAt: now,
    })
    .where(eq(claims.id, claimId));

  return {
    claimId,
    updated: true,
    structured_facts: facts,
  };
}

async function attachEvidence(input: Record<string, unknown>) {
  const db = getDb();
  const claimId = requireClaimId(input);
  await mustClaim(claimId);
  const evidenceId = str(input.evidence_id ?? input.evidenceId);
  if (!evidenceId) {
    return {
      claimId,
      attached: false,
      message:
        "No evidence_id. The customer should upload from the on-screen upload panel, then retry with that id.",
    };
  }
  const [row] = await db
    .select()
    .from(evidence)
    .where(eq(evidence.id, evidenceId));
  if (!row) {
    throw new Error(`Evidence ${evidenceId} not found`);
  }
  if (row.claimId !== claimId) {
    await db
      .update(evidence)
      .set({ claimId })
      .where(eq(evidence.id, evidenceId));
  }
  return {
    claimId,
    evidenceId,
    attached: true,
    file_url: row.fileUrl,
  };
}

async function analyseDamageTool(input: Record<string, unknown>) {
  const db = getDb();
  const claimId = requireClaimId(input);
  await mustClaim(claimId);
  const ids = asStringArray(input.evidence_ids ?? input.evidenceIds);
  const rows = await db
    .select()
    .from(evidence)
    .where(eq(evidence.claimId, claimId));
  const files = (ids.length ? rows.filter((r) => ids.includes(r.id)) : rows).map(
    (r) => ({
      id: r.id,
      filename: r.filename,
      mimeType: r.mimeType,
      bytes: r.bytes,
    }),
  );

  const analysis = await analyseDamage(files);
  const estimate = estimateRepair(analysis.findings);

  for (const file of files) {
    await db
      .update(evidence)
      .set({
        extractedFacts: {
          observations: analysis.observations,
          findings: analysis.findings,
        },
        analysisConfidence: analysis.confidence,
        analysisLimitations: analysis.limitations,
      })
      .where(eq(evidence.id, file.id));
  }

  const [existingAssessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.claimId, claimId));

  const assessmentValues = {
    claimId,
    damageFindings: analysis.findings,
    assumptions: estimate.assumptions,
    label: "preliminary" as const,
    missingInformation: files.length
      ? existingAssessment?.missingInformation ?? []
      : ["No photos or documents attached"],
    updatedAt: new Date(),
    estimateLowCents: estimate.lowCents,
    estimateHighCents: estimate.highCents,
  };

  if (existingAssessment) {
    await db
      .update(assessments)
      .set(assessmentValues)
      .where(eq(assessments.claimId, claimId));
  } else {
    await db.insert(assessments).values(assessmentValues);
  }

  await db
    .update(claims)
    .set({
      confidence: analysis.confidence,
      updatedAt: new Date(),
    })
    .where(eq(claims.id, claimId));

  return {
    claimId,
    observations: analysis.observations,
    findings: analysis.findings,
    confidence: analysis.confidence,
    limitations: analysis.limitations,
    used_vision_model: analysis.usedVisionModel,
    used_local_model: analysis.usedLocalModel,
    analyzer: analysis.analyzer,
    estimate_low_cents: estimate.lowCents,
    estimate_high_cents: estimate.highCents,
    label: "preliminary",
  };
}

async function coverageTool(input: Record<string, unknown>) {
  const db = getDb();
  const claimId = requireClaimId(input);
  const claim = await mustClaim(claimId);
  const [policy] = await db
    .select()
    .from(policies)
    .where(eq(policies.id, claim.policyId));
  if (!policy) throw new Error("Policy missing for claim");

  const result = runCoverageCheck({
    policyStatus: policy.status,
    coverageType: policy.coverageType,
    startDate: policy.startDate,
    endDate: policy.endDate,
    incidentTime: claim.incidentTime,
    incidentType: claim.structuredFacts.incidentType ?? "collision",
    injuries: claim.structuredFacts.injuries ?? null,
  });

  await db
    .update(claims)
    .set({
      coverageStatus: result.status,
      coverageNotes: result.notes,
      coverageRuleRefs: result.ruleReferences,
      updatedAt: new Date(),
    })
    .where(eq(claims.id, claimId));

  return { claimId, ...result };
}

async function triageTool(input: Record<string, unknown>) {
  const db = getDb();
  const claimId = requireClaimId(input);
  const claim = await mustClaim(claimId);
  const evidenceRows = await db
    .select()
    .from(evidence)
    .where(eq(evidence.claimId, claimId));
  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.claimId, claimId));

  const missing = missingRequiredFields({
    incidentTime: claim.incidentTime,
    location: claim.location,
    narrative: claim.narrative,
  });

  const analysisConfidence =
    evidenceRows.find((e) => e.analysisConfidence)?.analysisConfidence ??
    claim.confidence ??
    null;

  const result = runTriage({
    injuries: claim.structuredFacts.injuries ?? null,
    injuryDescription: claim.structuredFacts.injuryDescription ?? null,
    emergencyServices: claim.structuredFacts.emergencyServices ?? null,
    immediateDanger: claim.structuredFacts.immediateDanger ?? null,
    conflictingAccounts: claim.structuredFacts.conflictingAccounts ?? null,
    missingRequiredFields: missing,
    coverageStatus: claim.coverageStatus,
    evidenceCount: evidenceRows.length,
    analysisConfidence,
  });

  const status =
    result.route === "urgent"
      ? "urgent"
      : result.route === "human_review"
        ? "human_review"
        : "decision_ready";

  await db
    .update(claims)
    .set({
      route: result.route,
      routeReason: result.reason,
      flags: result.flags,
      recommendedAction: result.recommendedAction,
      status,
      updatedAt: new Date(),
    })
    .where(eq(claims.id, claimId));

  if (assessment) {
    await db
      .update(assessments)
      .set({
        missingInformation: missing.length
          ? missing
          : assessment.missingInformation,
        updatedAt: new Date(),
      })
      .where(eq(assessments.claimId, claimId));
  }

  return { claimId, status, ...result };
}

async function estimateTool(input: Record<string, unknown>) {
  const db = getDb();
  const claimId = requireClaimId(input);
  await mustClaim(claimId);
  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.claimId, claimId));
  const findings = assessment?.damageFindings ?? [];
  const estimate = estimateRepair(findings);

  const values = {
    claimId,
    damageFindings: findings,
    estimateLowCents: estimate.lowCents,
    estimateHighCents: estimate.highCents,
    assumptions: estimate.assumptions,
    label: estimate.label,
    missingInformation:
      findings.length === 0
        ? ["Damage findings missing — estimate is a placeholder band"]
        : (assessment?.missingInformation ?? []),
    updatedAt: new Date(),
  };

  if (assessment) {
    await db
      .update(assessments)
      .set(values)
      .where(eq(assessments.claimId, claimId));
  } else {
    await db.insert(assessments).values(values);
  }

  return {
    claimId,
    estimate_low_cents: estimate.lowCents,
    estimate_high_cents: estimate.highCents,
    currency: estimate.currency,
    label: estimate.label,
    assumptions: estimate.assumptions,
    binding: false,
    message:
      "Preliminary / suggested range only. Not a repairer quote and not a settlement offer.",
  };
}

async function escalateTool(input: Record<string, unknown>, actor: AuditActor) {
  const db = getDb();
  const claimId = requireClaimId(input);
  await mustClaim(claimId);
  const reason =
    str(input.reason) ?? "Escalated for human judgment.";
  const urgent = Boolean(input.urgent) || /injur|danger|emergency|ambulance|hospital/i.test(reason);
  const route = urgent ? "urgent" : "human_review";
  const status = route === "urgent" ? "urgent" : "human_review";

  await db
    .update(claims)
    .set({
      route,
      routeReason: reason,
      status,
      flags: urgent
        ? ["escalated", "injury_or_safety"]
        : ["escalated"],
      recommendedAction: urgent
        ? "Urgent human handling. Safety first."
        : "Human review of the prepared case.",
      updatedAt: new Date(),
    })
    .where(eq(claims.id, claimId));

  return {
    claimId,
    queue: route,
    status,
    reason,
    actor,
    message: `Claim placed on the ${route} human queue.`,
  };
}

async function summaryTool(input: Record<string, unknown>) {
  const pack = await loadCasePack(requireClaimId(input));
  const { claim, customer, policy, evidenceRows, assessment, audit } = pack;

  const lines = [
    `Decision-ready summary for ${claim.id} (preliminary — not a binding decision).`,
    `Customer: ${customer.name} (${customer.id}). Policy: ${policy.id} (${policy.coverageType}, excess $${(policy.excessCents / 100).toFixed(0)}, ${policy.status}).`,
    `Vehicle: ${policy.vehicleYear} ${policy.vehicleMake} ${policy.vehicleModel} ${policy.registration}.`,
    `Incident: ${claim.incidentTime ?? "time unknown"} @ ${claim.location ?? "location unknown"}.`,
    `Customer narrative: ${claim.narrative ?? "not captured"}.`,
    `Structured facts: ${JSON.stringify(claim.structuredFacts)}`,
    `Coverage check (${claim.coverageStatus ?? "not run"}): ${claim.coverageNotes ?? "n/a"} Rules: ${(claim.coverageRuleRefs ?? []).join(", ") || "n/a"}.`,
    `Evidence: ${evidenceRows.length} file(s). ${evidenceRows
      .map(
        (e) =>
          `${e.filename} confidence=${e.analysisConfidence ?? "n/a"} ${e.analysisLimitations ?? ""}`,
      )
      .join(" | ") || "none"}`,
    `Assessment: ${
      assessment
        ? `${assessment.label} range ${assessment.estimateLowCents ?? "?"}–${assessment.estimateHighCents ?? "?"} cents. Assumptions: ${(assessment.assumptions ?? []).join("; ")}`
        : "none"
    }`,
    `Route: ${claim.route ?? "not triaged"} — ${claim.routeReason ?? ""}. Flags: ${(claim.flags ?? []).join(", ") || "none"}.`,
    `Recommended action (non-binding): ${claim.recommendedAction ?? "none"}.`,
    `Uncertainty: unknown values were left unknown. Do not treat estimates or coverage labels as final.`,
    `Audit events: ${audit.length}. Last: ${audit[0] ? `${audit[0].action} @ ${audit[0].timestamp.toISOString()}` : "none"}.`,
  ];

  const summary = lines.join("\n");
  const db = getDb();
  await db
    .update(claims)
    .set({ summary, updatedAt: new Date() })
    .where(eq(claims.id, claim.id));

  return {
    claimId: claim.id,
    summary,
    route: claim.route,
    status: claim.status,
  };
}

export async function loadCasePack(claimId: string) {
  const db = getDb();
  const claim = await mustClaim(claimId);
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, claim.customerId));
  const [policy] = await db
    .select()
    .from(policies)
    .where(eq(policies.id, claim.policyId));
  if (!customer || !policy) throw new Error("Case pack missing customer or policy");
  const evidenceRows = await db
    .select()
    .from(evidence)
    .where(eq(evidence.claimId, claimId));
  const [assessment] = await db
    .select()
    .from(assessments)
    .where(eq(assessments.claimId, claimId));
  const { auditEvents } = await import("@/db/schema");
  const audit = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.claimId, claimId))
    .orderBy(desc(auditEvents.timestamp));
  return { claim, customer, policy, evidenceRows, assessment: assessment ?? null, audit };
}

async function mustClaim(claimId: string) {
  const db = getDb();
  const [claim] = await db.select().from(claims).where(eq(claims.id, claimId));
  if (!claim) throw new Error(`Claim ${claimId} not found`);
  return claim;
}

function requireClaimId(input: Record<string, unknown>): string {
  const id = str(input.claim_id ?? input.claimId);
  if (!id) throw new Error("claim_id is required");
  return id;
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

function asFacts(value: unknown): StructuredFacts {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as StructuredFacts;
    } catch {
      return {};
    }
  }
  if (typeof value === "object") return value as StructuredFacts;
  return {};
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export async function searchCustomers(query: string) {
  const db = getDb();
  const q = `%${query}%`;
  return db
    .select()
    .from(customers)
    .where(
      or(
        ilike(customers.name, q),
        ilike(customers.email, q),
        ilike(customers.phone, q),
        ilike(customers.id, q),
      ),
    );
}

export async function listClaims() {
  const db = getDb();
  return db.select().from(claims).orderBy(desc(claims.updatedAt));
}
