# Handoff — 25% backend checkpoint

Open this file before adding UI. Branch: `cursor/ai-claims-agent-prototype-049c`. Product spec: root [`README.md`](../README.md) (sections 8–10, 14, 23). Do **not** implement [`docs/prd-v3.md`](prd-v3.md); that FNOL-only spec is superseded.

## What this 25% includes

Backend loop only. Tools persist to Postgres. Home is a status page. No customer call UI, no officer workspace.

- Drizzle schema: customers, policies, claims, evidence (bytes in Postgres), assessments, audit events
- Seed: 15 synthetic policyholders; demo claims `CLM-DEMO-A` / `B` / `C`
- Eleven tools via `executeTool` and `POST /api/tools/{name}` (each writes an audit row)
- Claims list/detail and officer **API** actions (no pages)
- Evidence upload and file-serve APIs
- Deterministic coverage, triage, and preliminary repair bands + Vitest
- ElevenLabs agent create script and signed-url route (unused by any page)

## File map

| Path | Role |
|---|---|
| `src/db/schema.ts` | Tables |
| `src/db/seed.ts` | Synthetic customers, policies, A/B/C claims, labelled SVG evidence |
| `src/db/index.ts` | Postgres.js + Drizzle |
| `src/lib/tools.ts` | All 11 tools + `loadCasePack` |
| `src/lib/triage.ts` | `auto_path` / `human_review` / `urgent` |
| `src/lib/coverage.ts` | Preliminary coverage vs source policy |
| `src/lib/estimate.ts` | Suggested repair bands |
| `src/lib/analyse.ts` | Vision if keys exist, else filename heuristic |
| `src/lib/demo.ts` | Demo scripts + ElevenLabs tool parameter schema |
| `src/lib/agent-prompt.ts` | Prompt used by `npm run agent:create` |
| `src/app/api/tools/[name]/route.ts` | Tool HTTP entry |
| `src/app/api/claims/` | List, case pack, officer actions |
| `src/app/api/evidence/` | `POST` upload, `GET …/file` |
| `src/app/api/conversation/signed-url/route.ts` | Private-agent start (Slice 2) |
| `scripts/create-elevenlabs-agent.ts` | Registers **client** tools |
| `docker-compose.yml` / `.env.example` | Local Postgres |

## Demo IDs

| Claim | Customer | Policy | Route | Story |
|---|---|---|---|---|
| `CLM-DEMO-A` | Maya Chen `CUST-MAYA` | `POL-1001` comprehensive | `auto_path` | Stationary rear-end, George Street, photos attached |
| `CLM-DEMO-B` | Liam O'Brien `CUST-LIAM` | `POL-1002` comprehensive | `human_review` | Conflicting liability / other-vehicle description |
| `CLM-DEMO-C` | Priya Nair `CUST-PRIYA` | `POL-1003` comprehensive | `urgent` | Neck pain, ambulance — safety override |

Spoken scripts and phones: `src/lib/demo.ts`.

## Tools

`get_customer`, `get_policy`, `create_claim`, `update_claim`, `attach_evidence`, `analyse_damage`, `run_coverage_check`, `run_triage`, `estimate_repair`, `escalate_claim`, `generate_summary`.

`POST /api/tools/{name}` with a JSON body (`policy_id`, `claim_id`, …). Also accepts an ElevenLabs webhook envelope `{ parameters, conversation_id }` if a server tool is wired later.

**ElevenLabs tools are client tools.** `npm run agent:create` puts them on the agent as `type: "client"`. Slice 2 `/call` must implement `useConversation` `clientTools` that `POST /api/tools/{name}` and return the JSON (or `resultText`) to the agent. Do not expect ElevenLabs to call our API unless you change the agent to webhook tools.

## Remaining slices

Work in this order. Do not skip to a pretty dashboard before voice can execute tools.

### Slice 2 — `/call` voice UI

- `src/app/call/page.tsx` with `@elevenlabs/react` `useConversation` (and `ConversationProvider` as required by the SDK)
- Signed URL from `GET /api/conversation/signed-url`
- Client tools → `POST /api/tools/{name}`
- Transcript + last tool results
- After a claim exists, an upload path to `POST /api/evidence` (a link is enough)
- `ELEVENLABS_API_KEY` + `ELEVENLABS_AGENT_ID`; run `npm run agent:create` if no agent id

### Slice 3 — officer workspace (README section 12)

Against APIs that already exist. No new backend required for the first paint.

- `/claims` from `GET /api/claims`
- `/claims/[id]` from `GET /api/claims/[id]` (`loadCasePack`): header, incident, coverage, evidence, assessment, risk, recommended action, officer actions, audit
- Actions: `POST /api/claims/[id]/actions` (`approve_next_stage`, `request_information`, `escalate`, `override`)
- Seeded A/B/C must be openable without a live call

### Slice 4 — evidence UI, live vision, polish

- Upload UI; display via `/api/evidence/[id]/file`
- Live `analyse_damage` when an LLM key is set; keep the heuristic fallback
- Loading states, conversation tuning, 3-minute demo notes, recorded-voice fallback
- **Skip** stretch FR-11 (multilingual) and FR-12 (repair booking)

## Guardrails

- Coverage and repair figures stay **preliminary** / **suggested**, `binding: false`. Never auto-deny or settle.
- Injury or immediate danger → `urgent`. Stop ordinary assessment.
- Unknown stays unknown. Do not invent customers, policies, or coverage.
- Synthetic data only.
- Missing ElevenLabs/LLM keys must not block schema, tools, APIs, dashboard (when built), or seed.
