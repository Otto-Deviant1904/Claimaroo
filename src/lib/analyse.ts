import type { ConfidenceLevel, DamageFinding } from "@/lib/types";

export type EvidenceFile = {
  id: string;
  filename: string;
  mimeType: string;
  bytes: Buffer | null;
};

export type AnalyzerKind = "local_model" | "vision" | "heuristic";

export type AnalyseOptions = {
  spokenHint?: string;
};

export type DamageAnalysis = {
  observations: string[];
  findings: DamageFinding[];
  confidence: ConfidenceLevel;
  limitations: string;
  usedVisionModel: boolean;
  usedLocalModel: boolean;
  analyzer: AnalyzerKind;
};

function heuristicFromFilename(filename: string): DamageFinding[] {
  const lower = filename.toLowerCase();
  const findings: DamageFinding[] = [];
  const push = (
    area: string,
    observation: string,
    severity: DamageFinding["severity"],
  ) =>
    findings.push({
      area,
      observation,
      severity,
      source: "heuristic",
    });

  if (lower.includes("front") && !lower.includes("rear")) {
    push(
      "front bumper",
      "Filename/label indicates front-end involvement.",
      lower.includes("severe") ? "severe" : "moderate",
    );
  } else if (lower.includes("rear") && !lower.includes("front")) {
    push(
      "rear bumper",
      "Filename/label indicates rear bumper involvement.",
      lower.includes("severe") ? "severe" : "moderate",
    );
  } else if (lower.includes("bumper")) {
    push(
      "bumper",
      "Filename/label indicates bumper damage; front vs rear is unclear from the name.",
      lower.includes("severe") ? "severe" : "moderate",
    );
  }
  if (lower.includes("dent")) {
    push("body panel", "Filename/label indicates a dent.", "moderate");
  }
  if (lower.includes("scratch") || lower.includes("scrape")) {
    push("paintwork", "Filename/label indicates surface scraping.", "minor");
  }
  if (lower.includes("headlight") || lower.includes("light")) {
    push("lighting", "Filename/label indicates a light cluster is affected.", "moderate");
  }
  if (lower.includes("windscreen") || lower.includes("windshield")) {
    push("windscreen", "Filename/label indicates glass damage.", "moderate");
  }
  if (findings.length === 0) {
    push(
      "unspecified",
      `No structured cues in filename "${filename}". A human should inspect the file.`,
      "unknown",
    );
  }
  return findings;
}

function isRasterImage(mime: string) {
  return mime.startsWith("image/") && !mime.includes("svg");
}

type LocalModelResponse = {
  observations?: string[];
  findings?: {
    area?: string;
    observation?: string;
    severity?: DamageFinding["severity"];
  }[];
  confidence?: "low" | "medium" | "high";
};

async function localModelAnalyse(file: EvidenceFile): Promise<DamageAnalysis | null> {
  const url = process.env.LOCAL_VISION_URL?.trim();
  if (!url) return null;
  if (!file.bytes || !isRasterImage(file.mimeType)) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.filename,
        mime_type: file.mimeType,
        image_base64: file.bytes.toString("base64"),
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as LocalModelResponse;
    const observations = (json.observations ?? [])
      .map((o) => o.trim())
      .filter(Boolean);
    const findings: DamageFinding[] = (json.findings ?? []).map((f) => ({
      area: f.area?.trim() || "observed",
      observation: f.observation?.trim() || "Local model returned an unlabeled finding.",
      severity: f.severity ?? "unknown",
      source: "local_model",
    }));
    if (findings.length === 0 && observations.length === 0) return null;
    return {
      observations: observations.length
        ? observations
        : findings.map((f) => f.observation),
      findings: findings.length
        ? findings
        : observations.map((observation) => ({
            area: "observed",
            observation,
            severity: "unknown" as const,
            source: "local_model" as const,
          })),
      confidence:
        json.confidence === "low" || json.confidence === "high"
          ? json.confidence
          : "medium",
      limitations:
        "Findings came from a local damage model. Lighting, angle, and concealment can hide damage. Not a repairer inspection. Preliminary, not binding.",
      usedVisionModel: false,
      usedLocalModel: true,
      analyzer: "local_model",
    };
  } catch {
    return null;
  }
}

function applyVisionLocations(
  localFindings: DamageFinding[],
  visionText: string,
): DamageFinding[] {
  const described = findingsFromVisionText(visionText);
  if (described.length === 0) return localFindings;
  return described;
}

async function locateLocalFindings(
  file: EvidenceFile,
  local: DamageAnalysis,
  options?: AnalyseOptions,
): Promise<DamageAnalysis> {
  const vision = await visionAnalyse(file, local.findings, options);
  if (!vision.text) {
    return {
      ...local,
      limitations: vision.error
        ? `${local.limitations} Vision locate failed (${vision.error}).`
        : local.limitations,
    };
  }
  const findings = applyVisionLocations(local.findings, vision.text);
  return {
    ...local,
    findings,
    observations: [vision.text],
    usedVisionModel: true,
    analyzer: findings.some((finding) => finding.source === "vision")
      ? "vision"
      : local.analyzer,
    limitations:
      "Photo description from a vision model. A local classifier first flagged possible damage. Lighting, angle, and concealment can hide damage. Not a repairer inspection. Preliminary, not binding.",
  };
}

function resolveVisionProvider(): "openai" | "anthropic" | null {
  const raw = (process.env.LLM_PROVIDER || "").trim().toLowerCase();
  if (raw === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

/** After local model miss/fail: GPT first, then Anthropic. Heuristic is last resort. */
function hardFallbackVisionProviders(): Array<"openai" | "anthropic"> {
  const providers: Array<"openai" | "anthropic"> = [];
  if (process.env.OPENAI_API_KEY?.trim()) providers.push("openai");
  if (process.env.ANTHROPIC_API_KEY?.trim()) providers.push("anthropic");
  return providers;
}

async function visionAnalyse(
  file: EvidenceFile,
  localFindings?: DamageFinding[],
  options?: AnalyseOptions,
  forcedProvider?: "openai" | "anthropic",
): Promise<{ text: string | null; error: string | null }> {
  const provider = forcedProvider ?? resolveVisionProvider();
  if (!provider) return { text: null, error: "no_provider" };
  if (!file.bytes) return { text: null, error: "no_bytes" };
  const mime = file.mimeType;
  if (!isRasterImage(mime)) return { text: null, error: "not_raster" };
  const b64 = file.bytes.toString("base64");

  const locateHint = localFindings?.length
    ? ` A local classifier flagged: ${localFindings
        .map((finding) => `${finding.area} (${finding.severity})`)
        .join("; ")}. Do not repeat those labels. Describe what the photo actually shows.`
    : "";
  const spokenHint = options?.spokenHint?.trim()
    ? ` Caller account for context only: ${options.spokenHint.trim().slice(0, 400)}. Use the pixels in this photo, not that account, to decide what is shown.`
    : "";
  const instruction =
    "You are assisting a motor-claims prototype. Describe only visible vehicle damage in THIS photo. If you cannot see damage, say so. Return 2-6 factual lines. Start each line with the vehicle area using left/right and front/rear when visible (e.g. left rear door, rear bumper, front bumper, right front fender). If the photo is the front of the vehicle, label it front — never call a front bumper, grille, bonnet, or headlight 'rear'. If it is the rear, label it rear. Then describe the visible damage in plain language: dents, creases, scratches, missing paint, misalignment, broken lights. Do not estimate cost. Do not state coverage. Label uncertainty." +
    spokenHint +
    locateHint;

  try {
    if (provider === "openai" && process.env.OPENAI_API_KEY) {
      let baseUrl = (
        process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1"
      ).replace(/\/+$/, "");
      if (baseUrl.endsWith("/chat/completions")) {
        baseUrl = baseUrl.replace(/\/chat\/completions$/, "");
      }
      if (baseUrl === "https://api.openai.com") {
        baseUrl = "https://api.openai.com/v1";
      }
      const model =
        process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini";
      const payload: Record<string, unknown> = {
        model,
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${b64}` },
              },
            ],
          },
        ],
      };
      // DeepSeek flash defaults to thinking mode; disable so output lands in content.
      if (baseUrl.includes("deepseek.com")) {
        payload.thinking = { type: "disabled" };
      }
      const request = async (body: Record<string, unknown>) =>
        fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      let res = await request(payload);
      if (!res.ok) {
        const err = await res.text();
        if (res.status === 400 && /max_tokens/.test(err)) {
          delete payload.max_tokens;
          payload.max_completion_tokens = 800;
          res = await request(payload);
        } else if (res.status === 404 && payload.model !== "gpt-4o-mini") {
          payload.model = "gpt-4o-mini";
          res = await request(payload);
        } else {
          return { text: null, error: `openai_http_${res.status}` };
        }
      }
      if (!res.ok) return { text: null, error: `openai_http_${res.status}` };
      const json = (await res.json()) as {
        choices?: {
          message?: {
            content?: string | { type?: string; text?: string }[] | null;
            reasoning_content?: string | null;
          };
        }[];
      };
      const message = json.choices?.[0]?.message;
      let content: string | null = null;
      if (typeof message?.content === "string") {
        content = message.content;
      } else if (Array.isArray(message?.content)) {
        content = message.content
          .map((part) =>
            typeof part === "string"
              ? part
              : typeof part?.text === "string"
                ? part.text
                : "",
          )
          .filter(Boolean)
          .join("\n");
      }
      if (!content?.trim() && typeof message?.reasoning_content === "string") {
        content = message.reasoning_content;
      }
      return content?.trim()
        ? { text: content, error: null }
        : { text: null, error: "empty_vision_text" };
    }

    if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 400,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mime, data: b64 },
                },
                { type: "text", text: instruction },
              ],
            },
          ],
        }),
      });
      if (!res.ok) return { text: null, error: `anthropic_http_${res.status}` };
      const json = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };
      const text = json.content?.find((c) => c.type === "text")?.text ?? null;
      return text?.trim()
        ? { text, error: null }
        : { text: null, error: "empty_vision_text" };
    }
  } catch {
    return { text: null, error: "vision_request_failed" };
  }
  return { text: null, error: "no_provider" };
}

/** Map free-text vision lines onto area labels the officer damage map understands. */
export function areaFromVisionObservation(observation: string): string {
  const lower = observation.toLowerCase();
  const patterns: [RegExp, string][] = [
    [/\bleft headlight\b/, "left headlight"],
    [/\bright headlight\b/, "right headlight"],
    [/\bfront bumper\b/, "front bumper"],
    [/\b(grille|hood|bonnet)\b/, "front bumper"],
    [/\brear bumper\b/, "rear bumper"],
    [/\btailgate\b/, "rear bumper"],
    [/\b(bed|tray|load.?bed)\b/, "rear bumper"],
    [/\bleft (door|wing|fender|quarter|mirror|side|panel)\b/, "left door"],
    [/\bright (door|wing|fender|quarter|mirror|side|panel)\b/, "right door"],
    [/\b(driver'?s?|offside)\b/, "right door"],
    [/\b(passenger'?s?|nearside)\b/, "left door"],
    [/\b(windscreen|windshield)\b/, "windscreen"],
    [/\broof\b/, "roof"],
    [/\bfront\b.{0,24}\bleft\b|\bleft\b.{0,24}\bfront\b/, "front left panel"],
    [/\bfront\b.{0,24}\bright\b|\bright\b.{0,24}\bfront\b/, "front right panel"],
    [/\brear\b.{0,24}\bleft\b|\bleft\b.{0,24}\brear\b/, "left door"],
    [/\brear\b.{0,24}\bright\b|\bright\b.{0,24}\brear\b/, "right door"],
    [/\bfront\b/, "front bumper"],
    [/\brear\b/, "rear bumper"],
  ];
  let best: { index: number; label: string } | null = null;
  for (const [re, label] of patterns) {
    const match = re.exec(lower);
    if (match == null) continue;
    if (best == null || match.index < best.index) {
      best = { index: match.index, label };
    }
  }
  return best?.label ?? "observed";
}

function findingsFromVisionText(text: string): DamageFinding[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean)
    .filter((l) => !/^uncertainty\b/i.test(l))
    .filter((l) => !/^overall\b/i.test(l))
    .filter((l) => !/^area of impact\b/i.test(l))
    .filter((l) => !/\bno visible damage\b/i.test(l))
    .filter((l) => !/^(none|n\/a)\.?$/i.test(l))
    .slice(0, 6);
  return lines.map((observation) => {
    const lower = observation.toLowerCase();
    let severity: DamageFinding["severity"] = "unknown";
    if (
      lower.includes("severe") ||
      lower.includes("crumpl") ||
      lower.includes("airbag") ||
      lower.includes("detached") ||
      lower.includes("dislodged") ||
      lower.includes("significant impact")
    ) {
      severity = "severe";
    } else if (
      lower.includes("dent") ||
      lower.includes("crack") ||
      lower.includes("smash") ||
      lower.includes("deform") ||
      lower.includes("misaligned") ||
      lower.includes("hole")
    ) {
      severity = "moderate";
    } else if (
      lower.includes("scratch") ||
      lower.includes("scuff") ||
      lower.includes("abrasion") ||
      lower.includes("minor")
    ) {
      severity = "minor";
    }
    return {
      area: areaFromVisionObservation(observation),
      observation,
      severity,
      source: "vision" as const,
    };
  });
}

function heuristicAnalysis(files: EvidenceFile[]): DamageAnalysis {
  const findings = files.flatMap((f) => heuristicFromFilename(f.filename));
  const hasVisionKey = Boolean(
    process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim(),
  );
  return {
    observations: findings.map((f) => f.observation),
    findings,
    confidence: "low",
    limitations: hasVisionKey
      ? "A vision model is configured, but the image analysis request failed or returned no usable text (check OPENAI_BASE_URL, OPENAI_VISION_MODEL, and API key validity). Fell back to filename/label heuristics. A claims officer must inspect the actual file. Preliminary, not binding."
      : "No local model and no OPENAI_API_KEY or ANTHROPIC_API_KEY was available (or the file is not a raster image), so analysis used filename/label heuristics only. A claims officer must inspect the actual file. Preliminary, not binding.",
    usedVisionModel: false,
    usedLocalModel: false,
    analyzer: "heuristic",
  };
}

const EMPTY_ANALYSIS: DamageAnalysis = {
  observations: [],
  findings: [],
  confidence: "low",
  limitations:
    "No evidence files were supplied. Analysis cannot run. This is not a damage finding.",
  usedVisionModel: false,
  usedLocalModel: false,
  analyzer: "heuristic",
};

async function analyseSingleFile(
  file: EvidenceFile,
  options?: AnalyseOptions,
): Promise<DamageAnalysis> {
  const local = await localModelAnalyse(file);
  if (local) return locateLocalFindings(file, local, options);

  // Hard fallback when local model is unset, down, empty, or throws:
  // try GPT (OpenAI) first, then Anthropic, then filename heuristic.
  for (const provider of hardFallbackVisionProviders()) {
    const vision = await visionAnalyse(file, undefined, options, provider);
    if (!vision.text) continue;
    const findings = findingsFromVisionText(vision.text);
    return {
      observations: [vision.text],
      findings: findings.length ? findings : heuristicFromFilename(file.filename),
      confidence: "medium",
      limitations:
        "Local damage model unavailable or returned no findings; fell back to cloud vision. Lighting, angle, and concealment can hide damage. Not a repairer inspection. Preliminary.",
      usedVisionModel: true,
      usedLocalModel: false,
      analyzer: "vision",
    };
  }

  return heuristicAnalysis([file]);
}

export function mergeDamageAnalyses(results: DamageAnalysis[]): DamageAnalysis {
  if (results.length === 0) return EMPTY_ANALYSIS;
  if (results.length === 1) return results[0];

  const rank = { low: 0, medium: 1, high: 2 } as const;
  const confidence = results.reduce<ConfidenceLevel>((worst, result) => {
    return rank[result.confidence] < rank[worst] ? result.confidence : worst;
  }, "high");

  const usedVisionModel = results.some((result) => result.usedVisionModel);
  const usedLocalModel = results.some((result) => result.usedLocalModel);
  const analyzer: AnalyzerKind = results.some((result) => result.analyzer === "vision")
    ? "vision"
    : results.some((result) => result.analyzer === "local_model")
      ? "local_model"
      : "heuristic";

  return {
    observations: results.flatMap((result) => result.observations),
    findings: results.flatMap((result) => result.findings),
    confidence,
    limitations: [...new Set(results.map((result) => result.limitations))].join(" "),
    usedVisionModel,
    usedLocalModel,
    analyzer,
  };
}

export async function analyseEachFile(
  files: EvidenceFile[],
  options?: AnalyseOptions,
): Promise<DamageAnalysis[]> {
  const results: DamageAnalysis[] = [];
  for (const file of files) {
    results.push(await analyseSingleFile(file, options));
  }
  return results;
}

/**
 * Isolated contract for damage analysis. Swap in a custom/local classifier
 * by setting LOCAL_VISION_URL or by changing only this module.
 */
export async function analyseDamage(
  files: EvidenceFile[],
  options?: AnalyseOptions,
): Promise<DamageAnalysis> {
  if (files.length === 0) return EMPTY_ANALYSIS;
  return mergeDamageAnalyses(await analyseEachFile(files, options));
}
