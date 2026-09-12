import { describe, expect, it } from "vitest";
import { estimateRepair } from "./estimate";

describe("estimateRepair", () => {
  it("uses the worst severity band and labels the range preliminary", () => {
    const result = estimateRepair([
      {
        area: "paintwork",
        observation: "scrape",
        severity: "minor",
        source: "heuristic",
      },
      {
        area: "rear bumper",
        observation: "dent",
        severity: "moderate",
        source: "heuristic",
      },
    ]);
    expect(result.label).toBe("preliminary");
    expect(result.binding).toBe(false);
    expect(result.lowCents).toBe(250000);
    expect(result.highCents).toBe(650000);
    expect(result.assumptions.length).toBeGreaterThan(0);
  });

  it("does not invent a precise quote when findings are empty", () => {
    const result = estimateRepair([]);
    expect(result.label).toBe("preliminary");
    expect(result.binding).toBe(false);
    expect(result.assumptions[0]).toMatch(/placeholder/i);
  });
});
