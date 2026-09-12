# System Architecture & Workflow

Status: descriptive, not prescriptive — this documents what the current code actually does, so it can act as the reference when building the dashboard (`frontend-prd.md`) or the voice UI (Slice 2). Where it disagrees with `technical-requirements.md`, that file wins (it's the locked spec); this file exists to explain *how the pieces fit together and why*, which the spec doesn't spell out on its own.

## 1. One-paragraph summary

A customer talks to a voice agent hosted by ElevenLabs. That agent doesn't touch our database directly — it calls "client tools" that run in the *browser tab*, which in turn call our own Next.js API routes, which read/write Postgres. Photo evidence goes through the same API and gets analyzed by an external vision model (OpenAI or Anthropic) or a filename heuristic if no key is set. Every tool call and every officer action writes an audit row. A claims officer reviews the resulting case on a dashboard and is the only one who can push a claim past `approved_next_stage`. Nothing in this system settles or pays a claim — every number is labeled preliminary.

## 2. Component diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                              BROWSER                                │
│                                                                       │
│   /call  (Slice 2 — not built yet)         /claims, /claims/[id]    │
│   @elevenlabs/react useConversation         officer dashboard        │
│   clientTools = fetch("/api/tools/{name}")  (this PRD's scope)      │
│        │                                          │                  │
└────────┼──────────────────────────────────────────┼──────────────────┘
         │ WebSocket                                 │ HTTP (fetch)
         ▼                                            ▼
┌─────────────────────┐                    ┌───────────────────────────┐
│   ELEVENLABS CLOUD    │                    │        NEXT.JS SERVER      │
│  voice + turn-taking  │                    │  (local dev: :3000)        │
│  LLM: gemini-2.0-flash│                    │                             │
│  (swappable per       │◄──signed-url───────│ /api/conversation/signed-url│
│   create-agent script)│                    │ /api/tools/[name]           │
└─────────────────────┘                    │ /api/claims, /api/claims/[id]│
                                            │ /api/claims/[id]/actions    │
                                            │ /api/evidence, /file        │
                                            └──────────┬──────────────────┘
                                                        │
                              ┌─────────────────────────┼───────────────────────┐
                              ▼                                                  ▼
                    ┌───────────────────┐                          ┌─────────────────────────┐
                    │  src/lib/tools.ts  │                          │  OPENAI / ANTHROPIC API   │
                    │  executeTool()     │──(image analysis)──────►│  gpt-4o-mini /             │
                    │  + triage/coverage/│                          │  claude-sonnet-4-5         │
                    │    estimate/analyse│                          │  (only if key is set;      │
                    └─────────┬─────────┘                          │   else heuristic fallback) │
                              │                                     └─────────────────────────┘
                              ▼
                    ┌───────────────────┐
                    │      POSTGRES       │
                    │ customers, policies,│
                    │ claims, evidence,    │
                    │ assessments,         │
                    │ audit_events         │
                    └───────────────────┘
```

## 3. Where things actually run

| Piece | Runs where | Notes |
|---|---|---|
| `/call`, `/claims/*` pages | Browser | Next.js renders them; the officer dashboard has no client tools, it's just fetch + render |
| Next.js API routes (`src/app/api/**`) | Local dev server (`npm run dev`), or wherever it's deployed | This is the only thing that talks to Postgres or holds API keys |
| Postgres | Docker container (`docker-compose.yml`) locally | Holds every table including raw evidence bytes |
| ElevenLabs Conversational AI | ElevenLabs' cloud | Holds the actual conversation LLM (Gemini 2.0 Flash by default) and voice pipeline; never talks to our DB directly |
| OpenAI / Anthropic vision call | Their cloud, invoked from our server | Only reached if `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` is set; otherwise `analyse.ts` never leaves the server |

Nothing here requires a public URL — the ElevenLabs agent's tools are registered as **client** tools (`scripts/create-elevenlabs-agent.ts`), so ElevenLabs pushes "call this tool" down to the browser tab over the WebSocket instead of hitting our server directly. That's why `localhost:3000` works for a live demo without tunneling.

## 4. Core workflows

### 4.1 Voice intake → structured claim

1. Customer opens `/call`; page fetches a signed WebSocket URL from `GET /api/conversation/signed-url` (needs `ELEVENLABS_API_KEY` + `ELEVENLABS_AGENT_ID`).
2. `useConversation` connects; the agent speaks the safety-check first message (`AGENT_FIRST_MESSAGE` in `src/lib/agent-prompt.ts`).
3. As the conversation progresses, the agent's LLM decides to call a tool (e.g. `get_customer`). ElevenLabs sends that call down to the browser.
4. The page's `clientTools[name]` handler runs, `POST`s `/api/tools/{name}` with the arguments.
5. `src/app/api/tools/[name]/route.ts` → `executeTool()` in `src/lib/tools.ts` → reads/writes Postgres → `recordAudit()` writes one `audit_events` row → returns JSON.
6. The browser hands that JSON back to ElevenLabs, which feeds it back into the conversation LLM to decide what to say next.
7. This repeats for `get_policy`, `create_claim`, `update_claim`, etc., until the agent has enough to move on.

### 4.2 Evidence upload → damage analysis

1. Once a claim exists, the `/call` page shows an upload control; the file goes to `POST /api/evidence` (multipart, max 10MB), which stores the bytes in Postgres and flips claim status `intake` → `awaiting_evidence`.
2. The agent calls `attach_evidence` (client tool) with the returned `evidence_id`, linking it to the claim if needed.
3. The agent calls `analyse_damage`. Server-side, `src/lib/analyse.ts` either:
   - calls OpenAI/Anthropic's vision endpoint with the image as base64 and parses the response into `DamageFinding[]`, **or**
   - if no key is set (or the file isn't a raster image), falls back to `heuristicFromFilename()` — pure keyword matching on the filename, no model call at all.
4. Findings are written to the `assessments` table; `estimate_repair` turns findings into a preliminary AUD range using `src/lib/estimate.ts`.

### 4.3 Coverage + triage (deterministic, not the LLM's call)

1. Agent calls `run_coverage_check` → `src/lib/coverage.ts` compares the claim against the policy's own recorded fields (status, coverage type, dates) — pure rule logic, no model involved. Result is always labeled `binding: false`.
2. Agent calls `run_triage` → `src/lib/triage.ts` applies hard rules: `injuries` or `immediateDanger` true forces `route: "urgent"` regardless of anything else the LLM said. Missing required fields or `conflictingAccounts` force `human_review`. This is the enforcement point for the "safety override" and "no auto-decline" guardrails — it works even if the conversation LLM never explicitly asks for escalation.
3. `generate_summary` compiles everything captured so far into one text block for the officer.

### 4.4 Officer review → decision

1. Officer opens `/claims`, then a specific `/claims/[id]`, both served from data already sitting in Postgres — this works identically whether or not a live call ever happened (seeded demo claims prove this).
2. Officer clicks an action → `POST /api/claims/[id]/actions` → `src/app/api/claims/[id]/actions/route.ts` updates `claims` and writes an `officer:{action}` audit row.
3. `approve_next_stage` is the **only** code path that can set status to `approved_next_stage` — the conversation LLM has no tool that can do this. That's the human gate.

## 5. Data model (summary — see `technical-requirements.md` R3 for the locked column-level spec)

`customers` → `policies` → `claims` → (`evidence`, `assessments` 1:1, `audit_events` many). Everything hangs off `claims.id`. `loadCasePack(claimId)` in `src/lib/tools.ts` is the one function that assembles a full case (claim + customer + policy + evidence + assessment + audit) — both `GET /api/claims/[id]` and the dashboard's server components should call this rather than re-querying each table separately.

## 6. Guardrails as architecture, not just prompt text

The prompt (`agent-prompt.ts`) *asks* the conversation LLM to behave safely, but the system doesn't rely on the LLM actually complying — every hard guardrail also exists as code the LLM can't talk its way around:

| Guardrail | Enforced by | Not just... |
|---|---|---|
| Safety override on injury | `runTriage()` hard-codes `route: "urgent"` when `injuries`/`immediateDanger` is true | ...the prompt telling the LLM to escalate |
| No auto-decline | `coverageStatus` of `not_covered`/`unclear` routes to `human_review`, never a denial state | ...the LLM being told not to deny claims |
| No invention | `get_customer`/`get_policy` return `found: false` + a "do not invent" message on no match | ...the LLM being told not to make things up |
| Officer gate | Only `POST /api/claims/[id]/actions` with `approve_next_stage` can set that status | ...the LLM being told a human must approve |
| Full audit trail | `recordAudit()` is called inside `executeTool()` itself, so every tool call is logged unconditionally | ...relying on the LLM to report what it did |

This matters for the dashboard: the officer isn't trusting the AI's self-report, they're looking at rows a deterministic function wrote.

## 7. External dependency failure modes

| Missing / down | Effect |
|---|---|
| `DATABASE_URL` / Postgres unreachable | `GET /api/claims` → `503` with empty list; claim detail queries throw, page should show an error state, not crash |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_AGENT_ID` | `GET /api/conversation/signed-url` → `503` with `missing: {apiKey, agentId}`; `/call` can't start a session. Everything else (tools, APIs, dashboard, seed) is unaffected |
| `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` both unset | `analyse_damage` silently uses the filename heuristic instead of a real vision call — no error, just lower-quality (and clearly labeled) findings |
| Vision API call fails at runtime (bad key, rate limit) | `visionAnalyse()` catches and returns `null`, which falls through to the same heuristic path — never throws up to the caller |

## 8. Extension point — swapping in a custom model later

If a custom-trained damage/injury severity classifier gets built later (discussed separately, not in scope now), the integration point is narrow and already isolated: `analyseDamage(files: EvidenceFile[]): Promise<DamageAnalysis>` in `src/lib/analyse.ts` is the entire contract. A custom model just needs to be called from inside that function (or a new function with the same signature) and return the same `{ observations, findings, confidence, limitations, usedVisionModel }` shape — nothing else in the system (tools, schema, dashboard) needs to know the difference between OpenAI, Anthropic, a heuristic, or a self-hosted model.

## 9. What's deliberately not agentic

The officer-facing actions (`approve_next_stage`, `request_information`, `escalate`, `override`) have no AI path to them at all — they only exist as direct HTTP calls the officer's own click makes. This isn't a gap to fill with more automation; it's the product's core positioning (README §4.2, "not a claim-denial engine") — the dashboard's job is to make the human's decision fast and well-informed, not to remove the human.
