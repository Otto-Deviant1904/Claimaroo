import type { TriageResult } from "@/lib/types";

export type TriageInput = {
  injuries: boolean | null;
  injuryDescription?: string | null;
  emergencyServices: boolean | null;
  immediateDanger: boolean | null;
  conflictingAccounts: boolean | null;
  missingRequiredFields: string[];
  coverageStatus: "likely_covered" | "not_covered" | "unclear" | null;
  evidenceCount: number;
  analysisConfidence: "high" | "medium" | "low" | null;
};

const REQUIRED_FOR_AUTO = [
  "incidentTime",
  "location",
  "narrative",
] as const;

export function missingRequiredFields(input: {
  incidentTime: string | null | undefined;
  location: string | null | undefined;
  narrative: string | null | undefined;
}): string[] {
  const missing: string[] = [];
  for (const key of REQUIRED_FOR_AUTO) {
    if (!input[key]) missing.push(key);
  }
  return missing;
}

export function runTriage(input: TriageInput): TriageResult {
  const flags: string[] = [];

  if (input.injuries) flags.push("injury_reported");
  if (input.immediateDanger) flags.push("immediate_danger");
  if (input.emergencyServices) flags.push("emergency_services");
  if (input.conflictingAccounts) flags.push("conflicting_accounts");
  if (input.missingRequiredFields.length) {
    flags.push("incomplete_intake");
  }
  if (input.evidenceCount === 0) flags.push("missing_evidence");
  if (input.coverageStatus === "not_covered") flags.push("coverage_gap");
  if (input.coverageStatus === "unclear") flags.push("coverage_unclear");
  if (input.analysisConfidence === "low") flags.push("low_analysis_confidence");

  if (input.injuries || input.immediateDanger) {
    return {
      route: "urgent",
      reason:
        input.immediateDanger
          ? "Immediate safety risk reported. Stop ordinary claim processing and escalate."
          : "Injury reported. Safety override — urgent human handling.",
      flags,
      recommendedAction:
        "Urgent human contact. Do not continue automated assessment. Confirm safety and emergency services.",
    };
  }

  if (input.conflictingAccounts) {
    return {
      route: "human_review",
      reason:
        "Customer account contains conflicting facts. The case is routed for human judgment rather than resolved by the agent.",
      flags,
      recommendedAction:
        "Claims officer should inspect the conflict, evidence, and policy record before any next step.",
    };
  }

  if (
    input.coverageStatus === "not_covered" ||
    input.coverageStatus === "unclear" ||
    input.coverageStatus === null
  ) {
    return {
      route: "human_review",
      reason:
        "Coverage is not a clear preliminary match, or has not been checked. The prototype never auto-declines a claim.",
      flags,
      recommendedAction:
        "Human review of coverage against the source policy record. Estimates remain non-binding.",
    };
  }

  if (input.missingRequiredFields.length > 0 || input.evidenceCount === 0) {
    return {
      route: "human_review",
      reason: `Intake is incomplete (${[...input.missingRequiredFields, input.evidenceCount === 0 ? "evidence" : null].filter(Boolean).join(", ")}).`,
      flags,
      recommendedAction:
        "Request the missing information or photos, then re-run triage. Do not treat as decision-ready.",
    };
  }

  if (input.analysisConfidence === "low") {
    return {
      route: "human_review",
      reason: "Damage analysis confidence is low. A human should inspect the evidence.",
      flags,
      recommendedAction:
        "Officer review of photos and findings before any repair pathway.",
    };
  }

  return {
    route: "auto_path",
    reason:
      "No safety flags, no conflicts, preliminary comprehensive coverage match, and required intake plus evidence are present.",
    flags,
    recommendedAction:
      "Suggested next stage: officer confirmation of the prepared case. Not a settlement or payment decision.",
  };
}
