import type {
  CoverageCheckResult,
  CoverageType,
} from "@/lib/types";

export type CoverageInput = {
  policyStatus: string;
  coverageType: CoverageType;
  startDate: string;
  endDate: string;
  incidentTime: string | null;
  incidentType: string | null;
  injuries: boolean | null;
};

function onCover(incidentTime: string | null, start: string, end: string): boolean | null {
  if (!incidentTime) return null;
  const incident = incidentTime.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}/.test(incident)) return null;
  return incident >= start && incident <= end;
}

export function runCoverageCheck(input: CoverageInput): CoverageCheckResult {
  const refs: string[] = [];
  const notes: string[] = [];

  if (input.policyStatus !== "active") {
    refs.push("POL-STATUS");
    return {
      status: "not_covered",
      label: "preliminary",
      binding: false,
      ruleReferences: refs,
      notes:
        "Preliminary: policy is not active on the source record. A human must confirm before any coverage decision.",
    };
  }

  const inForce = onCover(input.incidentTime, input.startDate, input.endDate);
  refs.push("POL-TERM");
  if (inForce === false) {
    return {
      status: "not_covered",
      label: "preliminary",
      binding: false,
      ruleReferences: refs,
      notes:
        "Preliminary: incident date appears outside the policy period on the source record. Not a binding decision.",
    };
  }
  if (inForce === null) {
    notes.push("Incident date is missing or unparsed, so term cannot be confirmed.");
  } else {
    notes.push("Incident date falls within the recorded policy period.");
  }

  const type = input.incidentType ?? "collision";
  refs.push(`COV-${input.coverageType.toUpperCase()}`);

  if (input.coverageType === "third_party") {
    if (type === "own_damage_only" || type === "collision") {
      return {
        status: "not_covered",
        label: "preliminary",
        binding: false,
        ruleReferences: refs,
        notes:
          "Preliminary: third-party policy typically does not cover the insured vehicle's own damage. Human review required. Not a denial.",
      };
    }
  }

  if (input.coverageType === "third_party_fire_theft" && type === "collision") {
    return {
      status: "not_covered",
      label: "preliminary",
      binding: false,
      ruleReferences: refs,
      notes:
        "Preliminary: third-party fire and theft does not usually cover collision damage to the insured vehicle. Human review required.",
    };
  }

  if (input.coverageType === "comprehensive") {
    notes.push(
      "Comprehensive cover on the source record is consistent with a collision to the insured vehicle, subject to excess and exclusions.",
    );
    if (input.injuries) {
      refs.push("COV-INJURY-REVIEW");
      notes.push("Injury reported — bodily injury handling stays with a human.");
    }
    return {
      status: inForce === null ? "unclear" : "likely_covered",
      label: "preliminary",
      binding: false,
      ruleReferences: refs,
      notes: `Preliminary only — not a binding insurance decision. ${notes.join(" ")}`,
    };
  }

  return {
    status: "unclear",
    label: "preliminary",
    binding: false,
    ruleReferences: refs,
    notes: `Preliminary: coverage type ${input.coverageType} needs human interpretation. ${notes.join(" ")}`,
  };
}
