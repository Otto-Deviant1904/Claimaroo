import type { DamageFinding, RepairEstimate } from "@/lib/types";

const BANDS = {
  minor: { low: 80_000, high: 180_000 },
  moderate: { low: 250_000, high: 650_000 },
  severe: { low: 800_000, high: 1_800_000 },
  unknown: { low: 150_000, high: 900_000 },
} as const;

export function estimateRepair(findings: DamageFinding[]): RepairEstimate {
  const severities = findings.map((f) => f.severity);
  const rank = { unknown: 0, minor: 1, moderate: 2, severe: 3 } as const;
  let worst: keyof typeof BANDS = "unknown";
  for (const s of severities) {
    if (rank[s] > rank[worst]) worst = s;
  }
  if (findings.length === 0) worst = "unknown";
  const band = BANDS[worst];
  const assumptions = [
    "Labour and parts are modelled from a simple severity band, not a repairer quote.",
    "Does not include hire car, towing, betterment, or total-loss assessment.",
    "Regional labour rates and parts availability are not priced.",
  ];
  if (findings.length === 0) {
    assumptions.unshift("No damage findings were available; range is a placeholder band.");
  }
  return {
    lowCents: band.low,
    highCents: band.high,
    currency: "AUD",
    label: "preliminary",
    assumptions,
    binding: false,
  };
}
