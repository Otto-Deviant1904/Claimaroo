import type { ClaimStatus, TriageRoute, TranscriptEntry } from "@/lib/types";

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  intake: "Intake",
  awaiting_evidence: "Awaiting evidence",
  decision_ready: "Decision ready",
  human_review: "Human review",
  urgent: "Urgent",
  approved_next_stage: "Approved next stage",
  info_requested: "Information requested",
  closed: "Closed",
};

export const ROUTE_LABELS: Record<TriageRoute, string> = {
  auto_path: "Standard path",
  human_review: "Human review",
  urgent: "Urgent escalation",
};

export const DAMAGE_ZONES = [
  "front",
  "rear",
  "left side",
  "right side",
  "windscreen",
  "roof",
  "left headlight",
  "right headlight",
] as const;

export type DamageZone = (typeof DAMAGE_ZONES)[number];

export type ClaimFindingView = {
  area: string;
  severity: "minor" | "moderate" | "severe" | "unknown";
  observation: string;
  source: string;
  confidence: number | null;
};

export type ClaimView = {
  id: string;
  name: string;
  customerId: string;
  vehicle: string;
  rego: string;
  policyId: string;
  incident: string;
  date: string | null;
  location: string | null;
  narrative: string;
  status: ClaimStatus;
  route: TriageRoute | null;
  riskFlags: string[];
  updatedAt: string;
  createdAt: string;
  facts: Record<string, string | number | boolean | null>;
  coverage: {
    type: string;
    excess: number | null;
    status: string;
    start: string | null;
    end: string | null;
    result: "pass" | "fail" | "needs_review";
    notes: string;
    rules: { id: string; text: string }[];
  };
  assessment: {
    estimate: { min: number; max: number } | null;
    findings: ClaimFindingView[];
    assumptions: string[];
    missing: string[];
  } | null;
  evidence: {
    filename: string;
    mime: string;
    uploadedAt: string | null;
    confidence: number | null;
    limitations: string | null;
    src: string | null;
  }[];
  confidence: number | null;
  conflictingAccounts: boolean | null;
  routeReason: string;
  recommendation: string;
  transcript: TranscriptEntry[];
  audit: {
    timestamp: string;
    actor: string;
    action: string;
    result: string;
  }[];
};

export function mapZone(area: string | null | undefined): DamageZone | null {
  const a = String(area || "").toLowerCase();
  const left = /\b(left|passenger'?s?|nearside)\b/.test(a);
  const right = /\b(right|driver'?s?|offside)\b/.test(a);
  if (/\b(headlight|headlights|light cluster)\b/.test(a)) {
    if (left && !right) return "left headlight";
    if (right && !left) return "right headlight";
    return null;
  }
  if (/\b(windscreen|windshield)\b/.test(a)) return "windscreen";
  if (/\bglass\b/.test(a)) {
    return /\b(rear|side|door|window)\b/.test(a) ? null : "windscreen";
  }
  if (/\broof\b/.test(a)) return "roof";
  if (/\b(door|doors|side|side panel)\b/.test(a)) {
    if (left && !right) return "left side";
    if (right && !left) return "right side";
    return null;
  }
  const front =
    /\b(front|grille)\b/.test(a) ||
    (/\bbumper\b/.test(a) && /\b(hood|bonnet)\b/.test(a));
  const rear =
    /\b(rear|taillight|taillights)\b/.test(a) ||
    (/\bbumper\b/.test(a) && /\b(boot|trunk)\b/.test(a));
  if (/\bbumper\b/.test(a) && !front && !rear) {
    // Prefer not to guess front vs rear for a bare "bumper".
    return null;
  }
  if (front && !rear) return "front";
  if (rear && !front) return "rear";
  return null;
}

export function pretty(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (v) => v.toUpperCase());
}

export function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function percent(value: number | null) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "Unknown";
}

export function dateLabel(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return formatMelbourneDayMonthYear(date);
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Deterministic AEST/AEDT labels — avoids Node vs browser en-AU ICU mismatches (Sep vs Sept). */
function formatMelbourneDayMonthYear(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const day = get("day");
  const month = SHORT_MONTHS[Number(get("month")) - 1] ?? "";
  const year = get("year");
  return `${day} ${month} ${year}`;
}

export function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const day = get("day");
  const month = SHORT_MONTHS[Number(get("month")) - 1] ?? "";
  const hour = get("hour").padStart(2, "0");
  const minute = get("minute").padStart(2, "0");
  return `${day} ${month} at ${hour}:${minute}`;
}

export function known(value: string | number | boolean | null | undefined) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value == null) return "Unknown";
  return String(value);
}

export function statusTone(status: ClaimStatus) {
  if (status === "decision_ready") return "info";
  if (status === "approved_next_stage") return "ready";
  if (status === "info_requested" || status === "human_review") return "review";
  if (status === "urgent") return "urgent";
  return "processing";
}

export function routeTone(route: TriageRoute | null) {
  if (route === "auto_path") return "ready";
  if (route === "human_review") return "review";
  if (route === "urgent") return "urgent";
  return "processing";
}
