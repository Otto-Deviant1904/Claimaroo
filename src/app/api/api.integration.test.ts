import { config } from "dotenv";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/db";
import { TOOL_NAMES } from "@/lib/types";
import { GET as healthGet } from "@/app/api/health/route";
import { GET as statusGet } from "@/app/api/status/route";
import { GET as toolsGet, POST as toolsPost } from "@/app/api/tools/[name]/route";
import { GET as claimsGet, OPTIONS as claimsOptions } from "@/app/api/claims/route";
import { GET as claimGet } from "@/app/api/claims/[id]/route";
import { POST as claimActionsPost } from "@/app/api/claims/[id]/actions/route";
import { POST as evidencePost } from "@/app/api/evidence/route";
import { GET as evidenceFileGet } from "@/app/api/evidence/[id]/file/route";
import { GET as elevenlabsTokenGet } from "@/app/api/elevenlabs/token/route";
import { GET as signedUrlGet } from "@/app/api/conversation/signed-url/route";
import { GET as scribeTokenGet } from "@/app/api/scribe-token/route";

config({ path: ".env.local" });
config({ path: ".env" });

const hasDb = Boolean(process.env.DATABASE_URL);

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type Json = Record<string, unknown>;

async function readJson(res: Response): Promise<Json> {
  return (await res.json()) as Json;
}

function toolCtx(name: string) {
  return { params: Promise.resolve({ name }) };
}

function idCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function postTool(name: string, body: Record<string, unknown>) {
  const request = new Request(`http://localhost/api/tools/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return toolsPost(request, toolCtx(name));
}

const savedEnv: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined) {
  if (!(key in savedEnv)) savedEnv[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
    delete savedEnv[key];
  }
});

describe("API routes without database", () => {
  it("GET /api/health", async () => {
    const res = await healthGet();
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("forward-2026-claims-agent");
  });

  it("GET /api/status", async () => {
    const res = await statusGet();
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(typeof body.elevenlabs).toBe("boolean");
    expect(typeof body.database).toBe("boolean");
    expect(body.llm === null || body.llm === "openai" || body.llm === "anthropic").toBe(
      true,
    );
  });

  it("GET /api/tools lists every tool", async () => {
    const res = await toolsGet();
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.tools).toEqual([...TOOL_NAMES]);
  });

  it("GET /api/elevenlabs/token returns agentId when public", async () => {
    setEnv("ELEVENLABS_AGENT_ID", "agent_test_public");
    setEnv("ELEVENLABS_AGENT_PUBLIC", "true");
    const res = await elevenlabsTokenGet();
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.agentId).toBe("agent_test_public");
  });

  it("GET /api/elevenlabs/token is 500 without agent id", async () => {
    setEnv("ELEVENLABS_AGENT_ID", undefined);
    setEnv("ELEVENLABS_AGENT_PUBLIC", "true");
    const res = await elevenlabsTokenGet();
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body.error).toEqual(expect.any(String));
  });

  it("GET /api/conversation/signed-url is 503 when keys are missing", async () => {
    setEnv("ELEVENLABS_API_KEY", undefined);
    setEnv("ELEVENLABS_AGENT_ID", undefined);
    setEnv("NEXT_PUBLIC_ELEVENLABS_AGENT_ID", undefined);
    const res = await signedUrlGet();
    expect(res.status).toBe(503);
    const body = await readJson(res);
    expect(body.missing).toEqual({ apiKey: true, agentId: true });
  });

  it("GET /api/scribe-token is 503 without API key", async () => {
    setEnv("ELEVENLABS_API_KEY", undefined);
    const res = await scribeTokenGet();
    expect(res.status).toBe(503);
    const body = await readJson(res);
    expect(body.missing).toEqual({ apiKey: true });
  });
});

describe.skipIf(!hasDb)("API routes with database", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL required for API integration tests");
    }
  });

  it("GET /api/claims includes seeded demos", async () => {
    const res = await claimsGet();
    const body = await readJson(res);
    expect(res.status).toBe(200);
    const ids = ((body.claims as { id: string }[]) ?? []).map((row) => row.id);
    expect(ids).toEqual(expect.arrayContaining(["CLM-DEMO-A", "CLM-DEMO-B", "CLM-DEMO-C"]));
  });

  it("OPTIONS /api/claims is 204 with CORS", async () => {
    const res = claimsOptions();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("GET /api/claims/CLM-DEMO-A strips evidence bytes", async () => {
    const res = await claimGet(new Request("http://localhost/api/claims/CLM-DEMO-A"), idCtx("CLM-DEMO-A"));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect((body.claim as { id: string }).id).toBe("CLM-DEMO-A");
    const evidence = body.evidence as { bytes?: unknown; hasFile?: boolean }[];
    expect(Array.isArray(evidence)).toBe(true);
    for (const row of evidence) {
      expect(row.bytes).toBeUndefined();
      expect(typeof row.hasFile).toBe("boolean");
    }
  });

  it("GET /api/claims/missing is 404", async () => {
    const res = await claimGet(
      new Request("http://localhost/api/claims/missing"),
      idCtx("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("POST get_customer finds Maya and rejects unknown names", async () => {
    const hit = await postTool("get_customer", { phone: "0412000001" });
    const found = await readJson(hit);
    expect(hit.status).toBe(200);
    expect(found.ok).toBe(true);
    expect((found.result as { found: boolean }).found).toBe(true);

    const miss = await postTool("get_customer", { name: "Not A Real Person" });
    const missed = await readJson(miss);
    expect(miss.status).toBe(200);
    const result = missed.result as { found: boolean; customer?: unknown };
    expect(result.found).toBe(false);
    expect(result.customer).toBeUndefined();
  });

  it("POST get_customer unwraps the ElevenLabs envelope", async () => {
    const res = await postTool("get_customer", {
      parameters: { phone: "0412000001" },
      conversation_id: "conv-test",
    });
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect((body.result as { found: boolean }).found).toBe(true);
  });

  it("POST get_policy finds POL-1001 and misses unknown ids", async () => {
    const hit = await postTool("get_policy", { policy_id: "POL-1001" });
    expect((await readJson(hit)).result).toMatchObject({ found: true });
    const miss = await postTool("get_policy", { policy_id: "POL-NONE" });
    expect((await readJson(miss)).result).toMatchObject({ found: false });
  });

  it("POST unknown tool is 400", async () => {
    const res = await postTool("not_a_tool", {});
    const body = await readJson(res);
    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("POST create_claim requires ids then creates a claim", async () => {
    const missing = await postTool("create_claim", {});
    expect(missing.status).toBe(400);

    const claimId = `CLM-TEST-${Date.now()}`;
    const created = await postTool("create_claim", {
      customer_id: "CUST-MAYA",
      policy_id: "POL-1001",
      claim_id: claimId,
      location: "Test location",
      narrative: "Automated integration test collision.",
    });
    const body = await readJson(created);
    expect(created.status).toBe(200);
    expect((body.result as { claimId: string }).claimId).toBe(claimId);
  });

  it("POST run_coverage_check covers a live Maya intake timestamp", async () => {
    const incidentTime = new Date().toISOString();
    const today = incidentTime.slice(0, 10);
    const policy = await postTool("get_policy", { policy_id: "POL-1001" });
    const policyBody = await readJson(policy);
    const record = (
      policyBody.result as {
        policy?: { start_date?: string; end_date?: string };
      }
    ).policy;
    expect(record?.start_date && today >= record.start_date).toBe(true);
    expect(record?.end_date && today <= record.end_date).toBe(true);

    const claimId = `CLM-COVER-${Date.now()}`;
    const created = await postTool("create_claim", {
      customer_id: "CUST-MAYA",
      policy_id: "POL-1001",
      claim_id: claimId,
      incident_time: incidentTime,
      location: "Reported during voice intake",
      narrative: "Live intake coverage regression.",
      structured_facts: { incidentType: "collision" },
    });
    expect(created.status).toBe(200);

    const coverage = await postTool("run_coverage_check", { claim_id: claimId });
    const coverageBody = await readJson(coverage);
    expect(coverage.status).toBe(200);
    expect(coverageBody.result).toMatchObject({
      status: "likely_covered",
      binding: false,
    });
  });

  it("claim lifecycle: update, evidence, tools, officer actions", async () => {
    const claimId = `CLM-LIFE-${Date.now()}`;
    const created = await postTool("create_claim", {
      customer_id: "CUST-MAYA",
      policy_id: "POL-1001",
      claim_id: claimId,
      location: "Initial",
      narrative: "Lifecycle test.",
    });
    expect(created.status).toBe(200);

    const updated = await postTool("update_claim", {
      claim_id: claimId,
      location: "Nepean Hwy",
    });
    expect(updated.status).toBe(200);
    expect((await readJson(updated)).result).toMatchObject({
      claimId,
      updated: true,
    });

    const noClaimUpdate = await postTool("update_claim", { location: "x" });
    expect(noClaimUpdate.status).toBe(400);

    const missingFile = await evidencePost(
      new Request("http://localhost/api/evidence", {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.set("claimId", claimId);
          return form;
        })(),
      }),
    );
    expect(missingFile.status).toBe(400);

    const missingClaimId = await evidencePost(
      new Request("http://localhost/api/evidence", {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.set("file", new File([PNG], "rear-dent.png", { type: "image/png" }));
          return form;
        })(),
      }),
    );
    expect(missingClaimId.status).toBe(400);

    const unknownClaim = await evidencePost(
      new Request("http://localhost/api/evidence", {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.set("claimId", "CLM-DOES-NOT-EXIST");
          form.set("file", new File([PNG], "rear-dent.png", { type: "image/png" }));
          return form;
        })(),
      }),
    );
    expect(unknownClaim.status).toBe(404);

    const uploaded = await evidencePost(
      new Request("http://localhost/api/evidence", {
        method: "POST",
        body: (() => {
          const form = new FormData();
          form.set("claimId", claimId);
          form.set("file", new File([PNG], "rear-dent.png", { type: "image/png" }));
          return form;
        })(),
      }),
    );
    const uploadBody = await readJson(uploaded);
    expect(uploaded.status).toBe(200);
    const evidenceId = uploadBody.evidenceId as string;
    expect(evidenceId).toMatch(/^EVD/);

    const fileRes = await evidenceFileGet(
      new Request(`http://localhost/api/evidence/${evidenceId}/file`),
      idCtx(evidenceId),
    );
    expect(fileRes.status).toBe(200);
    expect((await fileRes.arrayBuffer()).byteLength).toBeGreaterThan(0);

    const missingFileGet = await evidenceFileGet(
      new Request("http://localhost/api/evidence/EVD-NONE/file"),
      idCtx("EVD-NONE"),
    );
    expect(missingFileGet.status).toBe(404);

    const noClaimAttach = await postTool("attach_evidence", { evidence_id: evidenceId });
    expect(noClaimAttach.status).toBe(400);

    const attached = await postTool("attach_evidence", {
      claim_id: claimId,
      evidence_id: evidenceId,
    });
    expect(attached.status).toBe(200);
    expect((await readJson(attached)).result).toMatchObject({ attached: true });

    const analysed = await postTool("analyse_damage", { claim_id: claimId });
    expect(analysed.status).toBe(200);
    expect((await readJson(analysed)).ok).toBe(true);

    const noClaimAnalyse = await postTool("analyse_damage", {});
    expect(noClaimAnalyse.status).toBe(400);

    const coverage = await postTool("run_coverage_check", { claim_id: claimId });
    expect(coverage.status).toBe(200);

    const noClaimCoverage = await postTool("run_coverage_check", {});
    expect(noClaimCoverage.status).toBe(400);

    const estimate = await postTool("estimate_repair", { claim_id: "CLM-DEMO-A" });
    expect(estimate.status).toBe(200);
    expect((await readJson(estimate)).result).toMatchObject({ binding: false });

    const noClaimEstimate = await postTool("estimate_repair", {});
    expect(noClaimEstimate.status).toBe(400);

    const summary = await postTool("generate_summary", { claim_id: "CLM-DEMO-A" });
    expect(summary.status).toBe(200);
    expect(typeof (await readJson(summary)).resultText).toBe("string");

    const noClaimSummary = await postTool("generate_summary", {});
    expect(noClaimSummary.status).toBe(400);

    const noClaimTriage = await postTool("run_triage", {});
    expect(noClaimTriage.status).toBe(400);

    const noClaimEscalate = await postTool("escalate_claim", {});
    expect(noClaimEscalate.status).toBe(400);

    const unknownAction = await claimActionsPost(
      new Request(`http://localhost/api/claims/${claimId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "nope" }),
      }),
      idCtx(claimId),
    );
    expect(unknownAction.status).toBe(400);

    const info = await claimActionsPost(
      new Request(`http://localhost/api/claims/${claimId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_information", note: "Need more photos" }),
      }),
      idCtx(claimId),
    );
    expect(info.status).toBe(200);

    const overridden = await claimActionsPost(
      new Request(`http://localhost/api/claims/${claimId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "override", status: "human_review" }),
      }),
      idCtx(claimId),
    );
    expect(overridden.status).toBe(200);

    const escalated = await postTool("escalate_claim", {
      claim_id: claimId,
      reason: "Officer queue test",
    });
    expect(escalated.status).toBe(200);
  });

  it("run_triage routes DEMO-A auto and DEMO-C urgent", async () => {
    const auto = await postTool("run_triage", { claim_id: "CLM-DEMO-A" });
    expect(auto.status).toBe(200);
    expect((await readJson(auto)).result).toMatchObject({ route: "auto_path" });

    const urgent = await postTool("run_triage", { claim_id: "CLM-DEMO-C" });
    expect(urgent.status).toBe(200);
    expect((await readJson(urgent)).result).toMatchObject({ route: "urgent" });
  });

  it("approve_next_stage is the officer path to that status", async () => {
    const claimId = `CLM-APPR-${Date.now()}`;
    await postTool("create_claim", {
      customer_id: "CUST-MAYA",
      policy_id: "POL-1001",
      claim_id: claimId,
    });
    const approved = await claimActionsPost(
      new Request(`http://localhost/api/claims/${claimId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_next_stage" }),
      }),
      idCtx(claimId),
    );
    expect(approved.status).toBe(200);
    const pack = await claimGet(
      new Request(`http://localhost/api/claims/${claimId}`),
      idCtx(claimId),
    );
    expect((await readJson(pack)).claim).toMatchObject({
      id: claimId,
      status: "approved_next_stage",
    });
  });

  it("POST escalate action on a new claim", async () => {
    const claimId = `CLM-ESC-${Date.now()}`;
    await postTool("create_claim", {
      customer_id: "CUST-MAYA",
      policy_id: "POL-1001",
      claim_id: claimId,
    });
    const res = await claimActionsPost(
      new Request(`http://localhost/api/claims/${claimId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "escalate", note: "Need a person" }),
      }),
      idCtx(claimId),
    );
    expect(res.status).toBe(200);
    expect((await readJson(res)).ok).toBe(true);
  });

  afterAll(async () => {
    await getSql().end({ timeout: 5 });
  });
});
