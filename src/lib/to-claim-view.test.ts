import { describe, expect, it } from "vitest";
import { mapZone } from "./claim-view";
import { toClaimView } from "./to-claim-view";
import type { loadCasePack } from "./tools";

type CasePack = Awaited<ReturnType<typeof loadCasePack>>;

const stamp = new Date("2026-09-12T04:10:00Z");

function pack(overrides: {
  claim?: Partial<CasePack["claim"]>;
  facts?: CasePack["claim"]["structuredFacts"];
  policy?: Partial<CasePack["policy"]>;
  assessment?: CasePack["assessment"] | null;
  evidenceRows?: CasePack["evidenceRows"];
  audit?: CasePack["audit"];
} = {}): CasePack {
  return {
    customer: {
      id: "CUST-MAYA",
      name: "Maya Chen",
      email: "maya@example.test",
      phone: "0400000001",
      address: "Sydney",
    },
    policy: {
      id: "POL-1001",
      customerId: "CUST-MAYA",
      vehicleMake: "Mazda",
      vehicleModel: "3",
      vehicleYear: 2022,
      registration: "MCH 219",
      vehicleColour: "white",
      coverageType: "comprehensive",
      excessCents: 85000,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      relevantRules: [{ id: "DEMO-MOTOR-01", text: "Accidental damage is covered." }],
      ...overrides.policy,
    },
    claim: {
      id: "CLM-DEMO-A",
      customerId: "CUST-MAYA",
      policyId: "POL-1001",
      status: "decision_ready",
      incidentTime: "2026-09-10T08:42:00+10:00",
      location: "George Street",
      narrative: "Parked rear-end.",
      structuredFacts: {
        incidentType: "parked_damage",
        vehicleDrivable: true,
        conflictingAccounts: false,
        ...overrides.facts,
      },
      route: "auto_path",
      routeReason: "Localised rear damage.",
      confidence: "high",
      flags: [],
      coverageStatus: "likely_covered",
      coverageNotes: "Matches the listed vehicle.",
      coverageRuleRefs: ["DEMO-MOTOR-01"],
      recommendedAction: "Approve next stage for a repairer quote.",
      summary: null,
      officerNotes: null,
      conversationId: null,
      createdAt: stamp,
      updatedAt: stamp,
      ...overrides.claim,
    },
    evidenceRows: overrides.evidenceRows ?? [
      {
        id: "EVD-1",
        claimId: "CLM-DEMO-A",
        type: "image",
        filename: "rear-bumper.jpg",
        mimeType: "image/jpeg",
        fileUrl: "/api/evidence/EVD-1/file",
        bytes: Buffer.from("img"),
        extractedFacts: null,
        analysisConfidence: "high",
        analysisLimitations: "Preliminary.",
        createdAt: stamp,
      },
    ],
    assessment:
      overrides.assessment === undefined
        ? {
            claimId: "CLM-DEMO-A",
            damageFindings: [
              {
                area: "rear bumper",
                observation: "Dented bumper.",
                severity: "moderate",
                source: "vision",
              },
              {
                area: "paintwork",
                observation: "Scratch location unknown.",
                severity: "minor",
                source: "customer",
              },
            ],
            estimateLowCents: 120000,
            estimateHighCents: 220000,
            assumptions: ["Exterior only."],
            label: "preliminary",
            missingInformation: ["Paintwork location."],
            updatedAt: stamp,
          }
        : overrides.assessment,
    audit: overrides.audit ?? [
      {
        id: "AUD-1",
        claimId: "CLM-DEMO-A",
        timestamp: stamp,
        actor: "system",
        action: "claim_routed",
        tool: "run_triage",
        inputsSummary: "CLM-DEMO-A",
        resultSummary: "auto_path",
      },
    ],
  } as CasePack;
}

describe("toClaimView", () => {
  it("maps a seeded-style pack into officer fields", () => {
    const view = toClaimView(pack());
    expect(view.id).toBe("CLM-DEMO-A");
    expect(view.name).toBe("Maya Chen");
    expect(view.vehicle).toBe("2022 Mazda 3");
    expect(view.rego).toBe("MCH 219");
    expect(view.incident).toBe("Parked damage");
    expect(view.date).toBe("2026-09-10");
    expect(view.coverage.excess).toBe(850);
    expect(view.coverage.result).toBe("pass");
    expect(view.confidence).toBe(0.9);
    expect(view.assessment?.estimate).toEqual({ min: 1200, max: 2200 });
    expect(view.evidence[0]?.src).toBe("/api/evidence/EVD-1/file");
    expect(view.audit[0]?.result).toBe("auto_path");
  });

  it("keeps paintwork unplaced and rear bumper on the rear zone", () => {
    const view = toClaimView(pack());
    const findings = view.assessment?.findings ?? [];
    expect(mapZone(findings[0]?.area ?? "")).toBe("rear");
    expect(mapZone(findings[1]?.area ?? "")).toBeNull();
  });

  it("does not invent coverage, narrative, or a file URL", () => {
    const view = toClaimView(
      pack({
        claim: {
          narrative: null,
          coverageStatus: null,
          coverageNotes: null,
          recommendedAction: null,
          routeReason: null,
          confidence: null,
        },
        assessment: null,
        evidenceRows: [
          {
            id: "EVD-2",
            claimId: "CLM-DEMO-A",
            type: "document",
            filename: "statement.pdf",
            mimeType: "application/pdf",
            fileUrl: "/api/evidence/EVD-2/file",
            bytes: null,
            extractedFacts: null,
            analysisConfidence: null,
            analysisLimitations: null,
            createdAt: stamp,
          },
        ],
      }),
    );
    expect(view.narrative).toBe("No narrative captured.");
    expect(view.coverage.result).toBe("needs_review");
    expect(view.coverage.notes).toBe("Coverage has not been checked yet.");
    expect(view.recommendation).toBe("Review the case.");
    expect(view.routeReason).toBe("Not triaged yet.");
    expect(view.assessment).toBeNull();
    expect(view.evidence[0]?.src).toBeNull();
  });

  it("labels a coverage gap as fail without treating it as a denial", () => {
    const view = toClaimView(
      pack({ claim: { coverageStatus: "not_covered" } }),
    );
    expect(view.coverage.result).toBe("fail");
    expect(view.coverage.type).toBe("Comprehensive");
  });
});
