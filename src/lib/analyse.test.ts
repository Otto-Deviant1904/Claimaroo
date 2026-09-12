import { afterEach, describe, expect, it, vi } from "vitest";
import { analyseDamage } from "./analyse";

const png = {
  id: "EVD-1",
  filename: "rear-bumper-dent.png",
  mimeType: "image/png",
  bytes: Buffer.from("fake-image"),
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.LOCAL_VISION_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.LLM_PROVIDER;
});

describe("analyseDamage", () => {
  it("uses filename heuristics when no model is configured", async () => {
    const result = await analyseDamage([png]);
    expect(result.analyzer).toBe("heuristic");
    expect(result.usedLocalModel).toBe(false);
    expect(result.usedVisionModel).toBe(false);
    expect(result.findings.some((f) => f.source === "heuristic")).toBe(true);
    expect(result.limitations.toLowerCase()).toContain("preliminary");
  });

  it("prefers a local model when LOCAL_VISION_URL returns findings", async () => {
    process.env.LOCAL_VISION_URL = "http://127.0.0.1:9999/analyse";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          observations: ["Rear bumper crease"],
          findings: [
            {
              area: "rear bumper",
              observation: "Rear bumper crease",
              severity: "moderate",
            },
          ],
        }),
      })),
    );

    const result = await analyseDamage([png]);
    expect(result.analyzer).toBe("local_model");
    expect(result.usedLocalModel).toBe(true);
    expect(result.usedVisionModel).toBe(false);
    expect(result.findings[0]?.source).toBe("local_model");
    expect(result.findings[0]?.area).toBe("rear bumper");
  });

  it("falls through to heuristic if the local model request fails", async () => {
    process.env.LOCAL_VISION_URL = "http://127.0.0.1:9999/analyse";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      }),
    );

    const result = await analyseDamage([png]);
    expect(result.analyzer).toBe("heuristic");
    expect(result.usedLocalModel).toBe(false);
  });
});
