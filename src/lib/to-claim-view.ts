import { loadCasePack } from "@/lib/tools";
import type { ConfidenceLevel } from "@/lib/types";
import { pretty, type ClaimView } from "@/lib/claim-view";

type CasePack = Awaited<ReturnType<typeof loadCasePack>>;

function iso(value: Date | string | null | undefined) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function confidenceToNumber(value: ConfidenceLevel | null | undefined) {
  if (value === "high") return 0.9;
  if (value === "medium") return 0.75;
  if (value === "low") return 0.55;
  return null;
}

function coverageResult(status: CasePack["claim"]["coverageStatus"]) {
  if (status === "likely_covered") return "pass" as const;
  if (status === "not_covered") return "fail" as const;
  return "needs_review" as const;
}

export function toClaimView(pack: CasePack): ClaimView {
  const { claim, customer, policy, evidenceRows, assessment, audit } = pack;
  const facts = claim.structuredFacts ?? {};
  const vehicle = [policy.vehicleYear, policy.vehicleMake, policy.vehicleModel]
    .filter(Boolean)
    .join(" ")
    .trim();
  const evidenceConfidence = confidenceToNumber(
    evidenceRows[0]?.analysisConfidence,
  );

  return {
    id: claim.id,
    name: customer.name,
    customerId: customer.id,
    vehicle: vehicle || "Vehicle unknown",
    rego: policy.registration,
    policyId: claim.policyId,
    incident: facts.incidentType
      ? pretty(String(facts.incidentType))
      : "Collision",
    date: claim.incidentTime ? claim.incidentTime.slice(0, 10) : null,
    location: claim.location,
    narrative: claim.narrative || "No narrative captured.",
    status: claim.status,
    route: claim.route,
    riskFlags: claim.flags ?? [],
    updatedAt: iso(claim.updatedAt),
    createdAt: iso(claim.createdAt),
    facts: {
      incident_type: facts.incidentType ?? null,
      vehicle_drivable: facts.vehicleDrivable ?? null,
      airbags_deployed: facts.airbagsDeployed ?? null,
      weather: facts.weather ?? null,
      other_vehicles: facts.otherVehicles ?? null,
      police_notified: facts.policeNotified ?? null,
      passengers: facts.passengers ?? null,
    },
    coverage: {
      type: policy.coverageType ? pretty(policy.coverageType) : "Unknown",
      excess: policy.excessCents != null ? policy.excessCents / 100 : null,
      status: policy.status || "Unknown",
      start: policy.startDate,
      end: policy.endDate,
      result: coverageResult(claim.coverageStatus),
      notes: claim.coverageNotes || "Coverage has not been checked yet.",
      rules: policy.relevantRules ?? [],
    },
    assessment: assessment
      ? {
          estimate:
            assessment.estimateLowCents != null &&
            assessment.estimateHighCents != null
              ? {
                  min: assessment.estimateLowCents / 100,
                  max: assessment.estimateHighCents / 100,
                }
              : null,
          findings: (assessment.damageFindings ?? []).map((finding) => ({
            area: finding.area || "unspecified",
            severity: finding.severity || "unknown",
            observation: finding.observation || "",
            source: finding.source || "heuristic",
            confidence: evidenceConfidence,
          })),
          assumptions: assessment.assumptions ?? [],
          missing: assessment.missingInformation ?? [],
        }
      : null,
    evidence: evidenceRows.map((row) => ({
      filename: row.filename,
      mime: row.mimeType,
      uploadedAt: row.createdAt ? iso(row.createdAt) : null,
      confidence: confidenceToNumber(row.analysisConfidence),
      limitations: row.analysisLimitations,
      src: row.bytes && row.fileUrl ? row.fileUrl : null,
    })),
    confidence: confidenceToNumber(claim.confidence),
    conflictingAccounts: facts.conflictingAccounts ?? null,
    routeReason: claim.routeReason || "Not triaged yet.",
    recommendation: claim.recommendedAction || "Review the case.",
    transcript: claim.transcript ?? [],
    audit: audit.map((event) => ({
      timestamp: iso(event.timestamp),
      actor: event.actor,
      action: event.action,
      result: event.resultSummary || event.inputsSummary || event.action,
    })),
  };
}
