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

  it("hard-falls back to GPT vision when the local model fails and OPENAI_API_KEY is set", async () => {
    process.env.LOCAL_VISION_URL = "http://127.0.0.1:9999/analyse";
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.LLM_PROVIDER = "anthropic"; // must still prefer GPT after local miss
    process.env.ANTHROPIC_API_KEY = "ant-test";
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("9999")) {
        throw new Error("connection refused");
      }
      if (String(url).includes("api.anthropic.com")) {
        throw new Error("anthropic should not be first after local miss");
      }
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "- Rear bumper dented\n- Paint scratched on rear bumper",
              },
            },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyseDamage([png]);
    expect(result.analyzer).toBe("vision");
    expect(result.usedLocalModel).toBe(false);
    expect(result.usedVisionModel).toBe(true);
    expect(result.findings.some((f) => f.source === "vision")).toBe(true);
    expect(result.limitations.toLowerCase()).toContain("fell back to cloud vision");
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("/chat/completions"),
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.every(
        (call) => !String(call[0]).includes("api.anthropic.com"),
      ),
    ).toBe(true);
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
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("/chat/completions"),
      ),
    ).toBe(true);
    expect(result.analyzer).toBe("vision");
    expect(result.usedVisionModel).toBe(true);
    expect(result.findings.some((f) => f.source === "vision")).toBe(true);
    expect(result.findings.some((f) => f.area === "rear bumper")).toBe(true);
  });

  it("keeps local detections and asks ChatGPT to locate them on the vehicle", async () => {
    process.env.LOCAL_VISION_URL = "http://127.0.0.1:9999/analyse";
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("9999")) {
        return {
          ok: true,
          json: async () => ({
            observations: ["Detected door damage, confidence 0.58."],
            findings: [
              {
                area: "side (unspecified)",
                observation: "Detected door damage, confidence 0.58.",
                severity: "moderate",
              },
              {
                area: "side (unspecified)",
                observation: "Detected fender damage, confidence 0.35.",
                severity: "moderate",
              },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  "- Left rear door dented\n- Left rear fender and quarter panel creased",
              },
            },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyseDamage([png]);
    const { mapZone } = await import("./claim-view");
    expect(result.usedLocalModel).toBe(true);
    expect(result.usedVisionModel).toBe(true);
    expect(result.analyzer).toBe("vision");
    expect(result.findings[0]?.source).toBe("vision");
    expect(result.findings[0]?.observation).toMatch(/left rear door/i);
    expect(result.findings[0]?.area).toBe("left door");
    expect(result.findings[1]?.area).toBe("left door");
    expect(mapZone(result.findings[0]?.area ?? "")).toBe("left side");
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes("9999")),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("/chat/completions"),
      ),
    ).toBe(true);
  });

  it("does not treat a generic bumper filename as the rear", async () => {
    const result = await analyseDamage([
      {
        id: "EVD-FRONT",
        filename: "dented-white-bumper-blogbanner1.jpg",
        mimeType: "image/jpeg",
        bytes: null,
      },
    ]);
    expect(result.findings.some((f) => f.area === "rear bumper")).toBe(false);
    expect(result.findings.some((f) => f.area === "bumper")).toBe(true);
  });

  it("analyses every uploaded photo instead of stopping at the first local hit", async () => {
    process.env.LOCAL_VISION_URL = "http://127.0.0.1:9999/analyse";
    process.env.OPENAI_API_KEY = "sk-test";
    let visionCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("9999")) {
        return {
          ok: true,
          json: async () => ({
            observations: ["Detected bumper damage"],
            findings: [
              {
                area: "bumper",
                observation: "Detected bumper damage",
                severity: "moderate",
              },
            ],
          }),
        };
      }
      visionCalls += 1;
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  visionCalls === 1
                    ? "- Rear bumper crushed and misaligned"
                    : "- Front bumper dented beside the left headlight",
              },
            },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyseDamage([
      png,
      {
        id: "EVD-2",
        filename: "front-bumper.jpg",
        mimeType: "image/jpeg",
        bytes: Buffer.from("fake-front"),
      },
    ]);

    expect(
      fetchMock.mock.calls.filter((call) => String(call[0]).includes("9999"))
        .length,
    ).toBe(2);
    expect(
      fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes("/chat/completions"),
      ).length,
    ).toBe(2);
    expect(result.findings.some((f) => f.area === "rear bumper")).toBe(true);
    expect(result.findings.some((f) => f.area === "front bumper")).toBe(true);
  });

  it("maps vision observation text to mappable vehicle areas", async () => {
    const { areaFromVisionObservation } = await import("./analyse");
    const { mapZone } = await import("./claim-view");
    expect(areaFromVisionObservation("The front bumper is severely damaged.")).toBe(
      "front bumper",
    );
    expect(
      areaFromVisionObservation(
        "Front bumper dented beside the left headlight",
      ),
    ).toBe("front bumper");
    expect(areaFromVisionObservation("Grille is cracked and the bonnet is creased.")).toBe(
      "front bumper",
    );
    expect(
      areaFromVisionObservation(
        "The left headlight assembly appears misaligned and partially detached.",
      ),
    ).toBe("left headlight");
    expect(
      areaFromVisionObservation("Left side panel: Scrapes and deformation observed."),
    ).toBe("left door");
    expect(areaFromVisionObservation("Bed of truck: Slight scratches noted.")).toBe(
      "rear bumper",
    );
    expect(
      areaFromVisionObservation("Driver's side door: Significant dent and scratches."),
    ).toBe("right door");
    expect(mapZone("front bumper")).toBe("front");
    expect(mapZone("left headlight")).toBe("left headlight");
    expect(mapZone("left door")).toBe("left side");
    expect(mapZone("observed")).toBeNull();
  });
});
