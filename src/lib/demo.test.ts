import { describe, expect, it } from "vitest";
import { demoPolicyTerm } from "./demo";

describe("demoPolicyTerm", () => {
  it("uses the Australian FY that contains the UTC date", () => {
    expect(demoPolicyTerm(new Date("2026-09-13T20:24:00.000Z"))).toEqual({
      startDate: "2026-07-01",
      endDate: "2027-06-30",
    });
    expect(demoPolicyTerm(new Date("2026-06-30T23:59:59.000Z"))).toEqual({
      startDate: "2025-07-01",
      endDate: "2026-06-30",
    });
    expect(demoPolicyTerm(new Date("2026-07-01T00:00:00.000Z"))).toEqual({
      startDate: "2026-07-01",
      endDate: "2027-06-30",
    });
  });

  it("always includes the instant it is computed from", () => {
    const now = new Date();
    const term = demoPolicyTerm(now);
    const day = now.toISOString().slice(0, 10);
    expect(day >= term.startDate).toBe(true);
    expect(day <= term.endDate).toBe(true);
  });
});
