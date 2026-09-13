import type { StructuredFacts, TranscriptEntry } from "@/lib/types";

export const FALLBACK_LOCATION = "Reported during voice intake";

export function isFallbackNarrative(narrative: string | null | undefined): boolean {
  return Boolean(
    narrative?.includes("Voice session ended without an agent create_claim tool call"),
  );
}

export function isFallbackLocation(location: string | null | undefined): boolean {
  return !location || location === FALLBACK_LOCATION;
}

const PLACE_RE =
  /\b(road|rd\.?|street|st\.?|avenue|ave\.?|highway|hwy|motorway|square|parade|drive|dr\.?|terrace|tce\.?)\b/i;
const EMERGENCY_RE = /\b(ambulanc\w*|paramedic|hospital|emergency services)\b/i;
const INJURY_RE = /\b(injur\w*|hurt|bleed\w*|unconscious|neck)\b/i;
const DANGER_RE = /\b(on fire|trapped|immediate danger|not safe)\b/i;
const YES_RE = /^(oh,?\s*)?(yeah|yes|yep|yup)\b/i;
const SAFETY_QUESTION_RE = /\b(injur\w*|hurt|ambulanc\w*|hospital|emergency)\b/i;

export type InferredIntake = {
  facts: Partial<StructuredFacts>;
  location?: string;
  narrative?: string;
  incidentTime?: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function localIncidentTime(
  entries: TranscriptEntry[],
  now = new Date(),
): string {
  const userText = entries
    .filter((entry) => entry.role === "user")
    .map((entry) => entry.text)
    .join(" ");
  const match = userText.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)\b/i);
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (!match) {
    return `${date}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
  }
  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return `${date}T${pad(hours)}:${minutes}:00`;
}

export function inferIntakeFromTranscript(
  entries: TranscriptEntry[],
): InferredIntake {
  const userLines = entries
    .filter((entry) => entry.role === "user")
    .map((entry) => entry.text.trim())
    .filter(Boolean);
  const userText = userLines.join(" ");

  let injuries = INJURY_RE.test(userText) || EMERGENCY_RE.test(userText);
  let emergencyServices = EMERGENCY_RE.test(userText);
  const immediateDanger = DANGER_RE.test(userText);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.role !== "user") continue;
    const previous = [...entries.slice(0, i)]
      .reverse()
      .find((item) => item.role === "agent");
    if (!previous || !SAFETY_QUESTION_RE.test(previous.text)) continue;
    if (!YES_RE.test(entry.text.trim())) continue;
    injuries = true;
    if (EMERGENCY_RE.test(previous.text)) emergencyServices = true;
  }

  const facts: Partial<StructuredFacts> = {};
  if (injuries) {
    facts.injuries = true;
    facts.injuryDescription = emergencyServices
      ? "Ambulance or injury mentioned during the call."
      : "Injury mentioned during the call.";
  }
  if (emergencyServices) facts.emergencyServices = true;
  if (immediateDanger) facts.immediateDanger = true;

  let location: string | undefined;
  for (const line of userLines) {
    if (!PLACE_RE.test(line)) continue;
    location = line.replace(/^uh,?\s*/i, "").replace(/\.$/, "").trim();
  }

  const narrative = userLines
    .map((line) => line.replace(/^uh,?\s*/i, "").trim())
    .filter((line) => line.length > 12 && !/^(oh,?\s*)?(yeah|yes|yep|yup)[.!]?$/i.test(line))
    .join(" ");

  return {
    facts,
    incidentTime: localIncidentTime(entries),
    ...(location ? { location } : {}),
    ...(narrative ? { narrative } : {}),
  };
}

function preferInferredFlag(
  stored: boolean | null | undefined,
  inferred: boolean | null | undefined,
): boolean | null {
  if (inferred === true) return true;
  return stored ?? null;
}

export function applyInferredIntake(
  claim: {
    structuredFacts: StructuredFacts;
    location: string | null;
    narrative: string | null;
    incidentTime: string | null;
  },
  entries: TranscriptEntry[],
) {
  const inferred = inferIntakeFromTranscript(entries);
  return {
    structuredFacts: {
      ...claim.structuredFacts,
      injuries: preferInferredFlag(
        claim.structuredFacts.injuries,
        inferred.facts.injuries,
      ),
      injuryDescription:
        inferred.facts.injuryDescription ??
        claim.structuredFacts.injuryDescription ??
        null,
      emergencyServices: preferInferredFlag(
        claim.structuredFacts.emergencyServices,
        inferred.facts.emergencyServices,
      ),
      immediateDanger: preferInferredFlag(
        claim.structuredFacts.immediateDanger,
        inferred.facts.immediateDanger,
      ),
    },
    location:
      isFallbackLocation(claim.location) && inferred.location
        ? inferred.location
        : claim.location,
    narrative:
      isFallbackNarrative(claim.narrative) && inferred.narrative
        ? inferred.narrative
        : claim.narrative,
    incidentTime: claim.incidentTime ?? inferred.incidentTime,
  };
}
