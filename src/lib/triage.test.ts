import { describe, expect, it } from "vitest";
import { missingRequiredFields, runTriage } from "./triage";

describe("runTriage", () => {
  it("routes injury to urgent", () => {
    const result = runTriage({
      injuries: true,
      emergencyServices: true,
      immediateDanger: false,
      conflictingAccounts: false,
      missingRequiredFields: [],
      coverageStatus: "likely_covered",
      evidenceCount: 2,
      analysisConfidence: "high",
    });
    expect(result.route).toBe("urgent");
    expect(result.flags).toContain("injury_reported");
  });

  it("routes immediate danger to urgent even without injury flag", () => {
    const result = runTriage({
      injuries: false,
      emergencyServices: false,
      immediateDanger: true,
      conflictingAccounts: false,
      missingRequiredFields: [],
      coverageStatus: "likely_covered",
      evidenceCount: 1,
      analysisConfidence: "medium",
    });
    expect(result.route).toBe("urgent");
  });

  it("routes conflicting accounts to human review", () => {
    const result = runTriage({
      injuries: false,
      emergencyServices: false,
      immediateDanger: false,
      conflictingAccounts: true,
      missingRequiredFields: [],
      coverageStatus: "likely_covered",
      evidenceCount: 1,
      analysisConfidence: "medium",
    });
    expect(result.route).toBe("human_review");
    expect(result.flags).toContain("conflicting_accounts");
  });

  it("never auto-declines a coverage gap", () => {
    const result = runTriage({
      injuries: false,
      emergencyServices: false,
      immediateDanger: false,
      conflictingAccounts: false,
      missingRequiredFields: [],
      coverageStatus: "not_covered",
      evidenceCount: 2,
      analysisConfidence: "high",
    });
    expect(result.route).toBe("human_review");
    expect(result.flags).toContain("coverage_gap");
  });

  it("sends a complete straightforward collision to auto_path", () => {
    const result = runTriage({
      injuries: false,
      emergencyServices: false,
      immediateDanger: false,
      conflictingAccounts: false,
      missingRequiredFields: [],
      coverageStatus: "likely_covered",
      evidenceCount: 2,
      analysisConfidence: "medium",
    });
    expect(result.route).toBe("auto_path");
  });

  it("holds auto_path when evidence is missing", () => {
    const result = runTriage({
      injuries: false,
      emergencyServices: false,
      immediateDanger: false,
      conflictingAccounts: false,
      missingRequiredFields: [],
      coverageStatus: "likely_covered",
      evidenceCount: 0,
      analysisConfidence: null,
    });
    expect(result.route).toBe("human_review");
    expect(result.flags).toContain("missing_evidence");
  });
});

describe("missingRequiredFields", () => {
  it("lists blank intake fields", () => {
    expect(
      missingRequiredFields({
        incidentTime: null,
        location: "Sydney",
        narrative: "",
      }),
    ).toEqual(["incidentTime", "narrative"]);
  });
});
