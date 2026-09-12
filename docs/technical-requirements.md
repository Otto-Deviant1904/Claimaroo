# Technical Requirements Specification — Forward 2026 AI Claims Agent

| Field | Value |
|---|---|
| Version | 1.0 |
| Date | 11 September 2026 |
| Status | **Locked** |
| Source of truth | This document. On conflict with the proposal in `README.md`, this specification wins. `docs/prd-v3.md` is superseded and must not be implemented. |
| Code baseline | `origin/main` after PR #3 (`8479593`) |

Everything below is **MUST** unless marked SHOULD or MAY. Tables, enumerations, tool names, and HTTP routes are verified against the cited files on that baseline.

## Assumptions

- **Deploy:** Render web service + Render Postgres. Bind HTTP to `0.0.0.0:$PORT`. The filesystem is ephemeral; evidence bytes stay in Postgres (`evidence.bytes`). Change this document if you host elsewhere.
- **LLM:** OpenAI is the default when `OPENAI_API_KEY` is set. Anthropic is selected with `LLM_PROVIDER=anthropic` (or when only `ANTHROPIC_API_KEY` is set). No third provider.
- **Voice:** Browser only, via the ElevenLabs React SDK. Phone / SIP is out of the 48-hour prototype.

---

## R1. Stack (locked)

| Layer | Locked choice | Evidence |
|---|---|---|
| App | One Next.js **16** App Router app, TypeScript. No separate FastAPI or Node service. | `package.json` (`next` `16.3.4`), `src/app/` |
| Database | Postgres **16** + Drizzle. No Supabase client. No ORM swap. | `docker-compose.yml` (`postgres:16-alpine`), `drizzle.config.ts`, `src/db/` |
| Voice | ElevenLabs Agents. Client: `@elevenlabs/react`. Agent create: `@elevenlabs/elevenlabs-js`. | `package.json`, `scripts/create-elevenlabs-agent.ts` |
| Tool execution | Tools are registered as **client** tools. `/call` MUST execute them with `POST /api/tools/{name}`. ElevenLabs does not call our API unless the agent is later changed to webhook tools. | `scripts/create-elevenlabs-agent.ts` (`type: "client"`), `src/app/api/tools/[name]/route.ts` |
| LLM (vision) | OpenAI or Anthropic behind `LLM_PROVIDER`. Heuristic fallback if neither key is set. | `src/lib/analyse.ts` |
| Styling | Tailwind 4 | `package.json` (`tailwindcss`), `src/app/globals.css` |
| Tests | Vitest | `package.json` (`npm test` → `vitest run`), `src/lib/*.test.ts` |
| Package manager | npm | `package-lock.json` |
| Local DB | docker-compose | `docker-compose.yml` |
| Deploy | Render web service; `next start --hostname 0.0.0.0` (PORT from the environment) | `package.json` `start` script |

---

## R2. Architecture

Concrete form of README section 8.

```
CUSTOMER
   |
   v
 /call  (ElevenLabs useConversation, browser only)
   |  client tool call
   v
 POST /api/tools/{name}          POST /api/evidence  (multipart)
   |                                    |
   v                                    v
 src/lib/tools.ts executeTool        evidence.bytes (Postgres)
   |  + triage / coverage / estimate / analyse
   v
 Postgres  (customers, policies, claims, evidence, assessments, audit_events)
   |
   v
 GET /api/claims  GET /api/claims/{id}  POST /api/claims/{id}/actions
   |
   v
 /claims  and  /claims/[id]  (officer workspace — Slice 3)
```

`executeTool` in `src/lib/tools.ts` always writes one `audit_events` row (`src/lib/audit.ts` `recordAudit`). Evidence upload also writes an audit row from `src/app/api/evidence/route.ts`.

---

## R3. Data model

Locked to `src/db/schema.ts`. Enumerations locked to `src/lib/types.ts`.

### Tables

#### `customers`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `CUST-MAYA` |
| `name` | text not null | |
| `email` | text not null | |
| `phone` | text not null | |
| `address` | text not null | |

#### `policies`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `POL-1001` |
| `customer_id` | text FK → customers | |
| `vehicle_make` | text not null | |
| `vehicle_model` | text not null | |
| `vehicle_year` | integer not null | |
| `registration` | text not null | |
| `vehicle_colour` | text | nullable |
| `coverage_type` | text `CoverageType` | see enumerations |
| `excess_cents` | integer not null | AUD cents |
| `start_date` | text not null | `YYYY-MM-DD` |
| `end_date` | text not null | `YYYY-MM-DD` |
| `status` | text not null | unconstrained in schema; seed uses `active` / `expired` |
| `relevant_rules` | jsonb `PolicyRule[]` | `{ id, text }` |

#### `claims`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `CLM-DEMO-A` |
| `customer_id` | text FK | |
| `policy_id` | text FK | |
| `status` | text `ClaimStatus` | |
| `incident_time` | text | nullable |
| `location` | text | nullable |
| `narrative` | text | nullable |
| `structured_facts` | jsonb `StructuredFacts` | default `{}` |
| `route` | text `TriageRoute` | nullable |
| `route_reason` | text | nullable |
| `confidence` | text `ConfidenceLevel` | nullable |
| `flags` | jsonb `string[]` | default `[]` |
| `coverage_status` | text `CoverageStatus` | nullable |
| `coverage_notes` | text | nullable |
| `coverage_rule_refs` | jsonb `string[]` | default `[]` |
| `recommended_action` | text | nullable |
| `summary` | text | nullable |
| `officer_notes` | text | nullable |
| `conversation_id` | text | nullable |
| `created_at` | timestamptz | default now |
| `updated_at` | timestamptz | default now |

#### `evidence`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `EVD-A-1` |
| `claim_id` | text FK | |
| `type` | text not null | upload sets `photo` if `image/*`, else `document` |
| `filename` | text not null | |
| `mime_type` | text not null | |
| `file_url` | text not null | `/api/evidence/{id}/file` |
| `bytes` | bytea | stored in Postgres; not on disk |
| `extracted_facts` | jsonb | nullable |
| `analysis_confidence` | text `ConfidenceLevel` | nullable |
| `analysis_limitations` | text | nullable |
| `created_at` | timestamptz | default now |

#### `assessments`

| Column | Type | Notes |
|---|---|---|
| `claim_id` | text PK FK → claims | one assessment per claim |
| `damage_findings` | jsonb `DamageFinding[]` | default `[]` |
| `estimate_low_cents` | integer | nullable |
| `estimate_high_cents` | integer | nullable |
| `assumptions` | jsonb `string[]` | default `[]` |
| `label` | text not null | default `"preliminary"` |
| `missing_information` | jsonb `string[]` | default `[]` |
| `updated_at` | timestamptz | default now |

#### `audit_events`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `claim_id` | text | nullable (lookup tools may have no claim yet) |
| `timestamp` | timestamptz | default now |
| `actor` | text not null | `agent` \| `officer` \| `system` \| `customer` (`src/lib/audit.ts`) |
| `action` | text not null | e.g. `tool:get_policy`, `officer:approve_next_stage` |
| `tool` | text | nullable |
| `inputs_summary` | text | truncated |
| `result_summary` | text | truncated |

Every `executeTool` call writes one `audit_events` row. MUST keep that behaviour.

### Enumerations (`src/lib/types.ts`)

| Name | Values |
|---|---|
| `ClaimStatus` | `intake`, `awaiting_evidence`, `decision_ready`, `human_review`, `urgent`, `approved_next_stage`, `info_requested`, `closed` |
| `TriageRoute` | `auto_path`, `human_review`, `urgent` |
| `CoverageStatus` | `likely_covered`, `not_covered`, `unclear` |
| `ConfidenceLevel` | `high`, `medium`, `low` |
| `CoverageType` | `comprehensive`, `third_party`, `third_party_fire_theft` |
| `DamageFinding.severity` | `minor`, `moderate`, `severe`, `unknown` |
| `DamageFinding.source` | `vision`, `heuristic`, `customer` |

`StructuredFacts` keys (all optional / nullable): `injuries`, `injuryDescription`, `emergencyServices`, `immediateDanger`, `otherVehicles`, `otherPartyDetails`, `atFaultStatement`, `conflictingAccounts`, `conflictNotes`, `weather`, `policeNotified`, `passengers`, `airbagsDeployed`, `vehicleDrivable`, `incidentType`.

### Seeded demo claims (`src/db/seed.ts`, `src/lib/demo.ts`)

| Claim | Customer | Policy | Route / status |
|---|---|---|---|
| `CLM-DEMO-A` | Maya Chen `CUST-MAYA` | `POL-1001` | `auto_path` / `decision_ready` |
| `CLM-DEMO-B` | Liam O'Brien `CUST-LIAM` | `POL-1002` | `human_review` |
| `CLM-DEMO-C` | Priya Nair `CUST-PRIYA` | `POL-1003` | `urgent` |

---

## R4. Tool contracts

Locked to `TOOL_NAMES` in `src/lib/types.ts` and `TOOL_PARAM_SCHEMA` in `src/lib/demo.ts`. Implementation: `src/lib/tools.ts` `executeTool`. HTTP: `src/app/api/tools/[name]/route.ts`.

Snake_case parameters are canonical. The implementation also accepts camelCase aliases (`customerId`, `claimId`, …). Agent create required-parameter lists: `scripts/create-elevenlabs-agent.ts`.

Coverage and estimate outputs MUST include a non-binding label:

- Coverage: `label: "preliminary"`, `binding: false` (`CoverageCheckResult` in `src/lib/types.ts`, `src/lib/coverage.ts`)
- Estimate: `label: "preliminary"` or `"suggested"`, `binding: false` (`RepairEstimate`; `src/lib/estimate.ts` currently always emits `"preliminary"`)

| Tool | Mode | Inputs (`TOOL_PARAM_SCHEMA`) | Output (as implemented) |
|---|---|---|---|
| `get_customer` | Read | `customer_id`, `phone`, `email`, `name` (any one) | `{ found, customer, policy_ids }` or `{ found: false, message }` — MUST NOT invent a customer |
| `get_policy` | Read | `policy_id`, `customer_id`, `registration` | `{ found, policy }` with vehicle, `coverage_type`, `excess_cents`, term, `status`, `relevant_rules` — MUST NOT invent coverage |
| `create_claim` | Write | **required** `customer_id`, `policy_id`; optional `incident_time`, `location`, `narrative`, `structured_facts`, `conversation_id` | `{ claimId, status: "intake", message }` |
| `update_claim` | Write | **required** `claim_id`; optional incident/location/narrative/`structured_facts` (merged) | `{ claimId, updated: true, structured_facts }` |
| `attach_evidence` | Write | **required** `claim_id`; `evidence_id` | `{ attached: true, evidenceId, file_url }` or `{ attached: false, message }` if no id |
| `analyse_damage` | Write | **required** `claim_id`; optional `evidence_ids` | `{ observations, findings, confidence, limitations, used_vision_model, label: "preliminary" }` |
| `run_coverage_check` | Write | **required** `claim_id` | `{ claimId, status, label: "preliminary", binding: false, ruleReferences, notes }` |
| `run_triage` | Write | **required** `claim_id` | `{ claimId, status, route, reason, flags, recommendedAction }` |
| `estimate_repair` | Write | **required** `claim_id` | `{ estimate_low_cents, estimate_high_cents, currency: "AUD", label, assumptions, binding: false, message }` |
| `escalate_claim` | Write | **required** `claim_id`; `reason`; `urgent` | `{ queue, status, reason, message }` — injury/danger language or `urgent: true` → `urgent` |
| `generate_summary` | Write | **required** `claim_id` | `{ claimId, summary, route, status }` persisted on `claims.summary` |

Unknown tool name → thrown error → HTTP 400.

---

## R5. HTTP API

All routes live under `src/app/api/`. Response shapes and status codes as implemented.

### `POST /api/tools/{name}`

`src/app/api/tools/[name]/route.ts`

Body: JSON object of tool parameters, **or** ElevenLabs webhook envelope `{ tool_call_id?, tool_name?, parameters, conversation_id }` (the handler unwraps `parameters` and copies `conversation_id`).

| Status | Body |
|---|---|
| 200 | `{ ok: true, result, resultText }` (`resultText` is `JSON.stringify(result)` for the voice client) |
| 400 | `{ ok: false, error }` (unknown tool, missing required fields, not found, etc.) |

`GET /api/tools/{name}` returns `{ tools: TOOL_NAMES }` (name in the path is ignored).

### `GET /api/claims`

`src/app/api/claims/route.ts`

| Status | Body |
|---|---|
| 200 | `{ claims: [{ id, status, route, location, incidentTime, updatedAt, customerName, policyId, flags }] }` newest first |
| 503 | `{ error, claims: [] }` if `DATABASE_URL` / DB unavailable |

### `GET /api/claims/{id}`

`src/app/api/claims/[id]/route.ts`

| Status | Body |
|---|---|
| 200 | `{ claim, customer, policy, evidence, assessment, audit }` via `loadCasePack`. Evidence rows have `bytes` stripped and `hasFile: boolean`. |
| 404 | `{ error }` when the message contains `"not found"` |
| 503 | `{ error }` other load failures |

### `POST /api/claims/{id}/actions`

`src/app/api/claims/[id]/actions/route.ts`

JSON: `{ action, note?, status?, route? }`

`action` MUST be one of: `approve_next_stage`, `request_information`, `escalate`, `override`.

| Status | Body |
|---|---|
| 400 | `{ error: "Unknown action" }` |
| 200 | `escalate` → `{ ok: true, result }` (via `escalate_claim`) |
| 200 | other actions → `{ ok: true, action, claimId }` |

Effects: `approve_next_stage` sets status `approved_next_stage` (this is the **only** path to that status). `request_information` sets `info_requested`. `override` MAY set `status` and `route` from the body. All non-escalate actions write `officer:{action}` audit. Officer actions are the only path to `approved_next_stage`.

### `POST /api/evidence`

`src/app/api/evidence/route.ts` — `multipart/form-data` fields `claimId`, `file`. Max 10MB.

| Status | Body |
|---|---|
| 400 | `{ error: "claimId is required" }` / `{ error: "file is required" }` / `{ error: "File too large (max 10MB)" }` |
| 404 | `{ error: "Claim not found" }` |
| 200 | `{ evidenceId, claimId, filename, fileUrl }` |

If the claim status is `intake`, it becomes `awaiting_evidence`. Bytes stored in Postgres.

### `GET /api/evidence/{id}/file`

`src/app/api/evidence/[id]/file/route.ts`

| Status | Body |
|---|---|
| 200 | Raw bytes, `Content-Type` from `mime_type`, `Content-Disposition: inline` |
| 404 | `{ error: "File not found" }` |

### `GET /api/conversation/signed-url`

`src/app/api/conversation/signed-url/route.ts`

| Status | Body |
|---|---|
| 200 | `{ signedUrl }` |
| 503 | `{ error, missing: { apiKey, agentId } }` if `ELEVENLABS_API_KEY` or agent id unset |
| 502 | `{ error: "Failed to get signed URL", detail }` |

### `GET /api/health`

`src/app/api/health/route.ts` — **200** `{ ok: true, service: "forward-2026-claims-agent" }`

### `GET /api/status`

`src/app/api/status/route.ts` — **200** `{ elevenlabs, elevenlabsKey, agentId, llm, database }` booleans / `llm` is `"openai"` \| `"anthropic"` \| `null`.

---

## R6. Pages (locked routes)

| Route | Slice | Requirement |
|---|---|---|
| `/` | 1 (exists) | Backend-checkpoint status page. `src/app/page.tsx`. Links to `/api/health`, `/api/claims`, `/api/status`. No voice widget. |
| `/call` | 2 | Customer voice. `@elevenlabs/react` `useConversation` (+ `ConversationProvider` as required by the SDK). Signed URL from `GET /api/conversation/signed-url`. `clientTools` MUST `POST /api/tools/{name}` and return `result` / `resultText` to the agent. Transcript + last tool results. After a claim exists, a path to `POST /api/evidence`. |
| `/claims` | 3 | Officer inbox from `GET /api/claims`. |
| `/claims/[id]` | 3 | Officer workspace from `GET /api/claims/{id}`. Nine panels from README section 12: **Claim header**, **Incident**, **Coverage**, **Evidence**, **Assessment**, **Risk & uncertainty**, **Recommended action**, **Actions**, **Audit**. Actions POST to `/api/claims/{id}/actions`. Seeded `CLM-DEMO-A/B/C` MUST open without a live call. |

Coverage panel MUST show policy source fields and label checks preliminary. Assessment MUST label the range preliminary / suggested. Recommended action MUST be explicitly non-binding.

---

## R7. Guardrails (hard)

1. **Safety override.** If `structured_facts.injuries` or `immediateDanger` is true, `runTriage` (`src/lib/triage.ts`) MUST return `route: "urgent"` and ordinary assessment (repair estimate / auto pathway) MUST stop. The agent prompt (`src/lib/agent-prompt.ts`) requires `escalate_claim` with `urgent=true` and emergency-services language.
2. **No invention.** Do not invent customers, policies, coverage, or damage facts. `get_customer` / `get_policy` return `found: false` and a “do not invent” message on miss. Unknown stays unknown.
3. **No auto-decline.** `coverageStatus: "not_covered"` or `"unclear"` routes to `human_review`, never a denial. `auto_path` means “suggested next stage for officer confirmation”, never paid or settled.
4. **Officer gate.** Only `POST /api/claims/{id}/actions` with `approve_next_stage` sets `approved_next_stage`. Still not a binding settlement (`src/app/api/claims/[id]/actions/route.ts`).
5. **Synthetic data only.** Seed and demos use `*.example.test` contacts. No real personal data.
6. **AI disclosure.** First agent utterance (`AGENT_FIRST_MESSAGE` in `src/lib/agent-prompt.ts`) identifies the assistant as AI and asks about safety/injury.
7. **Human on request.** The caller MAY ask for a human at any time; the agent MUST `escalate_claim`.
8. **Labels.** Speak and display “Based on your policy record…” and “preliminary estimate.” Never a quote or a promise to pay.

---

## R8. Environment variables

Names locked. File: `.env.example`. Next.js loads `.env.local`.

| Name | Slice 1 | Slice 2 | Slice 3 | Slice 4 | Notes |
|---|---|---|---|---|---|
| `DATABASE_URL` | **required** | required | required | required | docker-compose: `postgres://claims:claims@localhost:5432/claims` |
| `ELEVENLABS_API_KEY` | optional | **required** for live voice | optional | optional | Server only |
| `ELEVENLABS_AGENT_ID` | optional | **required** for live voice | optional | optional | From `npm run agent:create` |
| `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` | optional | SHOULD match agent id | optional | optional | Client fallback; signed-url also accepts this if server id unset |
| `OPENAI_API_KEY` | optional | optional | optional | SHOULD for live vision | Default provider |
| `ANTHROPIC_API_KEY` | optional | optional | optional | MAY | Used when `LLM_PROVIDER=anthropic` or OpenAI unset |
| `LLM_PROVIDER` | optional | optional | optional | optional | `openai` \| `anthropic`. Default: openai if that key exists, else anthropic (`src/lib/analyse.ts`) |
| `PORT` | Render | Render | Render | Render | Not in `.env.example`; Next.js `start` binds `0.0.0.0` and honours `PORT` |

Missing ElevenLabs or LLM keys MUST NOT block schema, tools, APIs, seed, or the officer UI. `analyse_damage` falls back to labelled filename heuristics.

---

## R9. Definition of done per slice

| Slice | Done when |
|---|---|
| **1** (merged, PR #3) | `npm test` green. Seeded A/B/C reachable via `GET /api/claims` and `POST /api/tools/*`. Status home at `/`. |
| **2** | A browser call on `/call` creates a persisted claim and at least two `audit_events` rows with `tool` set, without the tester calling the API by hand. |
| **3** | `/claims/CLM-DEMO-B` shows the conflict and `human_review` without a live call. An officer action changes status and writes an audit row. All nine section-12 panels present. |
| **4** | An uploaded image appears on the claim with a labelled finding (vision or heuristic). 3-minute demo runs on seeded data. Loading / gap states for missing keys. Skip FR-11 and FR-12. |

---

## R10. Out of scope (hard)

- FR-11 multilingual voice
- FR-12 repair booking / repairer network
- Phone, Twilio, SIP
- Real insurer / Guidewire / production policy admin
- Payments, settlement, claim denial as a product feature
- Identity verification / KYC beyond synthetic lookup
- Production security, compliance, model evaluation, monitoring
- Any claim type other than motor vehicle

---

## Precedence

1. This specification (locked).
2. Implementation on `main` for shapes already shipped (cite the file; do not silently diverge).
3. Proposal narrative in `README.md` (product intent).
4. `docs/handoff.md` (slice order).
5. `docs/prd-v3.md` — **do not implement**.
