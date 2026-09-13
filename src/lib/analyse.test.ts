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
  delete process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_VISION_MODEL;
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

  it("calls an OpenAI-compatible gateway with configured base URL and model", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_BASE_URL = "https://agentrouter.org/v1/";
    process.env.OPENAI_VISION_MODEL = "gpt-5.6-sol";
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://agentrouter.org/v1/chat/completions");
      const body = JSON.parse(String(init?.body)) as { model: string };
      expect(body.model).toBe("gpt-5.6-sol");
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "- Dent on rear bumper\n- Scratch on paintwork",
              },
            },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyseDamage([png]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.analyzer).toBe("vision");
    expect(result.usedVisionModel).toBe(true);
    expect(result.findings.some((f) => f.source === "vision")).toBe(true);
    expect(result.findings.some((f) => f.area === "rear bumper")).toBe(true);
  });

  it("maps vision observation text to mappable vehicle areas", async () => {
    const { areaFromVisionObservation } = await import("./analyse");
    const { mapZone } = await import("./claim-view");
    expect(areaFromVisionObservation("The front bumper is severely damaged.")).toBe(
      "front bumper",
    );
    expect(
      areaFromVisionObservation(
        "The left headlight assembly appears misaligned and partially detached.",
      ),
    ).toBe("left headlight");
    expect(mapZone("front bumper")).toBe("front");
    expect(mapZone("left headlight")).toBe("left headlight");
    expect(mapZone("observed")).toBeNull();
  });
});
