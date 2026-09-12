import { describe, expect, it } from "vitest";
import { runCoverageCheck } from "./coverage";

describe("runCoverageCheck", () => {
  const activeComprehensive = {
    policyStatus: "active",
    coverageType: "comprehensive" as const,
    startDate: "2025-07-01",
    endDate: "2026-06-30",
    incidentTime: "2026-03-10T08:42:00+10:00",
    incidentType: "collision",
    injuries: false,
  };

  it("labels a matching comprehensive collision as preliminary likely_covered", () => {
    const result = runCoverageCheck(activeComprehensive);
    expect(result.status).toBe("likely_covered");
    expect(result.label).toBe("preliminary");
    expect(result.binding).toBe(false);
    expect(result.notes.toLowerCase()).toContain("preliminary");
  });

  it("does not treat third-party own-damage as auto-covered", () => {
    const result = runCoverageCheck({
      ...activeComprehensive,
      coverageType: "third_party",
    });
    expect(result.status).toBe("not_covered");
    expect(result.binding).toBe(false);
    expect(result.notes.toLowerCase()).toMatch(/not a denial|human review/);
  });

  it("flags expired policies", () => {
    const result = runCoverageCheck({
      ...activeComprehensive,
      policyStatus: "expired",
    });
    expect(result.status).toBe("not_covered");
  });

  it("flags incidents outside the recorded term", () => {
    const result = runCoverageCheck({
      ...activeComprehensive,
      incidentTime: "2024-01-01",
    });
    expect(result.status).toBe("not_covered");
    expect(result.ruleReferences).toContain("POL-TERM");
  });

  it("stays unclear when the incident date is missing", () => {
    const result = runCoverageCheck({
      ...activeComprehensive,
      incidentTime: null,
    });
    expect(result.status).toBe("unclear");
  });
});
