import { describe, expect, it } from "vitest";
import type { TranscriptEntry } from "./types";
import {
  FALLBACK_LOCATION,
  applyInferredIntake,
  inferIntakeFromTranscript,
} from "./transcript-facts";

function turns(
  pairs: Array<["agent" | "user", string]>,
): TranscriptEntry[] {
  return pairs.map(([role, text], i) => ({
    at: new Date(1_700_000_000_000 + i * 1000).toISOString(),
    role,
    text,
  }));
}

describe("inferIntakeFromTranscript", () => {
  it("treats a customer ambulance mention as injury plus emergency services", () => {
    const inferred = inferIntakeFromTranscript(
      turns([
        ["agent", "Were there any injuries or did anyone require an ambulance?"],
        ["user", "Oh, yeah, yeah. One need ambulance."],
        ["agent", "And the exact location of the incident?"],
        ["user", "Uh, City Road."],
        [
          "user",
          "I got hit from the front and the rear. This happened at 7:00 AM.",
        ],
      ]),
    );

    expect(inferred.facts.injuries).toBe(true);
    expect(inferred.facts.emergencyServices).toBe(true);
    expect(inferred.location).toBe("City Road");
    expect(inferred.narrative).toMatch(/ambulance/i);
    expect(inferred.narrative).toMatch(/front and the rear/i);
    expect(inferred.incidentTime).toMatch(/T07:00:00$/);
  });

  it("does not treat the agent's ambulance question as a customer report", () => {
    const inferred = inferIntakeFromTranscript(
      turns([
        ["agent", "Were there any injuries or did anyone require an ambulance?"],
        ["user", "No, everyone is fine."],
      ]),
    );

    expect(inferred.facts.injuries).toBeUndefined();
    expect(inferred.facts.emergencyServices).toBeUndefined();
  });

  it("does not treat a yes to a safety check as an injury", () => {
    const inferred = inferIntakeFromTranscript(
      turns([
        ["agent", "Are you safe right now?"],
        ["user", "Yeah."],
      ]),
    );

    expect(inferred.facts.injuries).toBeUndefined();
    expect(inferred.facts.emergencyServices).toBeUndefined();
  });
});

describe("applyInferredIntake", () => {
  it("upgrades an early injuries:false once the caller reports an ambulance", () => {
    const applied = applyInferredIntake(
      {
        structuredFacts: { incidentType: "collision", injuries: false },
        location: FALLBACK_LOCATION,
        narrative:
          "Voice session ended without an agent create_claim tool call. Claim lodged from the intake page using the customer mobile on file.",
        incidentTime: "2026-09-13T22:35:00.000Z",
      },
      turns([
        ["agent", "Were there any injuries or did anyone require an ambulance?"],
        ["user", "Oh, yeah, yeah. One need ambulance."],
        ["user", "Uh, City Road."],
      ]),
    );

    expect(applied.structuredFacts.injuries).toBe(true);
    expect(applied.structuredFacts.emergencyServices).toBe(true);
    expect(applied.location).toBe("City Road");
    expect(applied.narrative).toMatch(/ambulance/i);
    expect(applied.incidentTime).toBe("2026-09-13T22:35:00.000Z");
  });
});
