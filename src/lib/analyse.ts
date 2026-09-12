import type { ConfidenceLevel, DamageFinding } from "@/lib/types";

export type EvidenceFile = {
  id: string;
  filename: string;
  mimeType: string;
  bytes: Buffer | null;
};

export type AnalyzerKind = "local_model" | "vision" | "heuristic";

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

  if (lower.includes("rear") || lower.includes("bumper")) {
    push(
      "rear bumper",
      "Filename/label indicates rear bumper involvement.",
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
      confidence: "medium",
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

async function visionAnalyse(file: EvidenceFile): Promise<string | null> {
  const provider =
    process.env.LLM_PROVIDER ||
    (process.env.OPENAI_API_KEY
      ? "openai"
      : process.env.ANTHROPIC_API_KEY
        ? "anthropic"
        : null);
  if (!provider) return null;
  if (!file.bytes) return null;
  const mime = file.mimeType;
  if (!isRasterImage(mime)) return null;
  const b64 = file.bytes.toString("base64");

  const instruction =
    "You are assisting a motor-claims prototype. Describe only visible vehicle damage. If you cannot see damage, say so. Return 2-6 short factual observations. Do not estimate cost. Do not state coverage. Label uncertainty.";

  try {
    if (provider === "openai" && process.env.OPENAI_API_KEY) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 400,
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
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return json.choices?.[0]?.message?.content ?? null;
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
      if (!res.ok) return null;
      const json = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };
      return json.content?.find((c) => c.type === "text")?.text ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function findingsFromVisionText(text: string): DamageFinding[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
  return lines.map((observation) => {
    const lower = observation.toLowerCase();
    let severity: DamageFinding["severity"] = "unknown";
    if (lower.includes("severe") || lower.includes("crumpl") || lower.includes("airbag")) {
      severity = "severe";
    } else if (lower.includes("dent") || lower.includes("crack") || lower.includes("smash")) {
      severity = "moderate";
    } else if (lower.includes("scratch") || lower.includes("scuff") || lower.includes("minor")) {
      severity = "minor";
    }
    return {
      area: "observed",
      observation,
      severity,
      source: "vision" as const,
    };
  });
}

function heuristicAnalysis(files: EvidenceFile[]): DamageAnalysis {
  const findings = files.flatMap((f) => heuristicFromFilename(f.filename));
  return {
    observations: findings.map((f) => f.observation),
    findings,
    confidence: "low",
    limitations:
      "No local model and no OPENAI_API_KEY or ANTHROPIC_API_KEY was available (or the file is not a raster image), so analysis used filename/label heuristics only. A claims officer must inspect the actual file. Preliminary, not binding.",
    usedVisionModel: false,
    usedLocalModel: false,
    analyzer: "heuristic",
  };
}

/**
 * Isolated contract for damage analysis. Swap in a custom/local classifier
 * by setting LOCAL_VISION_URL or by changing only this module.
 */
export async function analyseDamage(files: EvidenceFile[]): Promise<DamageAnalysis> {
  if (files.length === 0) {
    return {
      observations: [],
      findings: [],
      confidence: "low",
      limitations:
        "No evidence files were supplied. Analysis cannot run. This is not a damage finding.",
      usedVisionModel: false,
      usedLocalModel: false,
      analyzer: "heuristic",
    };
  }

  for (const file of files) {
    const local = await localModelAnalyse(file);
    if (local) return local;
  }

  const visionNotes: string[] = [];
  let usedVision = false;
  for (const file of files) {
    const text = await visionAnalyse(file);
    if (text) {
      usedVision = true;
      visionNotes.push(text);
    }
  }

  if (usedVision) {
    const findings = visionNotes.flatMap(findingsFromVisionText);
    return {
      observations: visionNotes,
      findings: findings.length
        ? findings
        : files.flatMap((f) => heuristicFromFilename(f.filename)),
      confidence: "medium",
      limitations:
        "Vision output is a model observation of uploaded pixels only. Lighting, angle, and concealment can hide damage. Not a repairer inspection. Preliminary.",
      usedVisionModel: true,
      usedLocalModel: false,
      analyzer: "vision",
    };
  }

  return heuristicAnalysis(files);
}
