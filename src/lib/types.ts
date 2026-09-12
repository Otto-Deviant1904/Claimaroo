export const CLAIM_STATUSES = [
  "intake",
  "awaiting_evidence",
  "decision_ready",
  "human_review",
  "urgent",
  "approved_next_stage",
  "info_requested",
  "closed",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const TRIAGE_ROUTES = ["auto_path", "human_review", "urgent"] as const;
export type TriageRoute = (typeof TRIAGE_ROUTES)[number];

export const COVERAGE_STATUSES = [
  "likely_covered",
  "not_covered",
  "unclear",
] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const COVERAGE_TYPES = [
  "comprehensive",
  "third_party",
  "third_party_fire_theft",
] as const;
export type CoverageType = (typeof COVERAGE_TYPES)[number];

export type StructuredFacts = {
  injuries?: boolean | null;
  injuryDescription?: string | null;
  emergencyServices?: boolean | null;
  immediateDanger?: boolean | null;
  otherVehicles?: number | null;
  otherPartyDetails?: string | null;
  atFaultStatement?: string | null;
  conflictingAccounts?: boolean | null;
  conflictNotes?: string | null;
  weather?: string | null;
  policeNotified?: boolean | null;
  passengers?: number | null;
  airbagsDeployed?: boolean | null;
  vehicleDrivable?: boolean | null;
  incidentType?: string | null;
};

export type PolicyRule = {
  id: string;
  text: string;
};

export type Vehicle = {
  make: string;
  model: string;
  year: number;
  registration: string;
  colour?: string;
};

export type DamageFinding = {
  area: string;
  observation: string;
  severity: "minor" | "moderate" | "severe" | "unknown";
  source: "vision" | "heuristic" | "customer" | "local_model";
};

export type CoverageCheckResult = {
  status: CoverageStatus;
  label: "preliminary";
  ruleReferences: string[];
  notes: string;
  binding: false;
};

export type TriageResult = {
  route: TriageRoute;
  reason: string;
  flags: string[];
  recommendedAction: string;
};

export type RepairEstimate = {
  lowCents: number;
  highCents: number;
  currency: "AUD";
  label: "preliminary" | "suggested";
  assumptions: string[];
  binding: false;
};

export const TOOL_NAMES = [
  "get_customer",
  "get_policy",
  "create_claim",
  "update_claim",
  "attach_evidence",
  "analyse_damage",
  "run_coverage_check",
  "run_triage",
  "estimate_repair",
  "escalate_claim",
  "generate_summary",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];
