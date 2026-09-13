import { describe, expect, it } from "vitest";
import { toClaimListItem } from "./claim-list";

describe("toClaimListItem", () => {
  it("maps list columns without needing a case pack", () => {
    const item = toClaimListItem({
      id: "CLM-DEMO-A",
      status: "decision_ready",
      route: "auto_path",
      incidentTime: "2026-09-10T08:42:00+10:00",
      location: "George Street",
      updatedAt: new Date("2026-09-12T04:10:00Z"),
      flags: [],
      structuredFacts: { incidentType: "parked_damage" },
      policyId: "POL-1001",
      customerName: "Maya Chen",
      vehicleYear: 2022,
      vehicleMake: "Toyota",
      vehicleModel: "Corolla",
      registration: "NSW-MAYA",
    });
    expect(item.vehicle).toBe("2022 Toyota Corolla");
    expect(item.incident).toBe("Parked damage");
    expect(item.date).toBe("2026-09-10");
    expect(item.name).toBe("Maya Chen");
  });
});
