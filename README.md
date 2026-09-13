<p align="center">
  <img src="docs/claimaroo-logo.png" alt="Claimaroo" width="320" />
</p>

# Claimaroo

A voice-first AI claims employee for Australian motor insurance. A policyholder describes an accident in a conversation; the agent retrieves the policy, persists a claim, analyses photos, runs deterministic coverage and triage checks, and hands a claims officer a decision-ready case. Nothing in this system settles or pays a claim — every number is labelled preliminary.

This is a working prototype (Forward 2026 hackathon), not a production insurer integration. All customers, policies, and evidence are synthetic.

## Table of contents

- [Key features](#key-features)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Architecture](#architecture)
- [Environment variables](#environment-variables)
- [Available scripts](#available-scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Further reading](#further-reading)
- [License](#license)

## Key features

- **Voice intake** — ElevenLabs Conversational AI in the browser (`/claim`). The agent asks adaptive questions; tools run in the page and persist to Postgres.
- **Structured claim state** — Conversation facts become a real `claims` row, not a transcript dump.
- **Evidence in the database** — Photos and documents are stored as `bytea` in Postgres (the disk is ephemeral on Render).
- **Damage analysis** — Local classifier first (if `LOCAL_VISION_URL` hits). Cloud vision then only **locates** those detections on the vehicle. If local misses every file, cloud vision analyses the photos itself. Otherwise a filename heuristic. Failures never throw.
- **Deterministic coverage and triage** — Rule code, not the conversation LLM, decides `likely_covered` / `human_review` / `urgent`. Injury or immediate danger always escalates.
- **Officer workspace** — Inbox at `/claims` and a case view at `/claims/[id]` with evidence, assessment, coverage, risk flags, recommended action, and audit.
- **Human gate** — Only an officer click on `approve_next_stage` can set that status. The agent has no tool that can do it.
- **Seeded demo book** — 15 synthetic policyholders and three distinct cases: straightforward rear-end (`CLM-DEMO-A`), conflicting accounts (`CLM-DEMO-B`), injury/urgent (`CLM-DEMO-C`).

## Tech stack

What `src/` actually imports and runs. `package.json` also lists `zod` and `@types/pg`; neither is used in application code.

| Layer | What the code uses |
| --- | --- |
| **Language** | TypeScript 5, `strict` (`tsconfig.json`) |
| **Runtime** | Node.js 20+ (`engines`). CI and Render use 22 |
| **App** | Next.js **16.3.4** App Router + React **19.2.8**. One process: pages and `src/app/api/**` |
| **Fonts** | Geist and Geist Mono via `next/font/google` (`src/app/layout.tsx`) |
| **Styling** | Custom CSS for the product UI: `src/app/landing.css` (`/`), `src/app/claimaroo.css` (`/claim`), `src/app/claims/claims.css` (`/claims`). Tailwind CSS **4** (`@import "tailwindcss"` in `globals.css`, PostCSS plugin `@tailwindcss/postcss`) is used on the root shell and the `/scribe` playground only. No component library (no shadcn, Radix, MUI) |
| **Database** | PostgreSQL **16** (`docker-compose.yml`, Render Blueprint) |
| **Data access** | Drizzle ORM **0.45** + **postgres.js** (`postgres`). Schema in `src/db/schema.ts`. Driver is not `pg` / `node-postgres` |
| **Schema / seed** | `drizzle-kit` push (no checked-in SQL migrations). Seed and scripts run with `tsx` |
| **Env loading** | Next.js `.env.local`; `dotenv` in `src/db/index.ts`, `src/db/seed.ts`, `drizzle.config.ts`, and `scripts/create-elevenlabs-agent.ts` |
| **Voice** | ElevenLabs Conversational AI. Browser: `@elevenlabs/react` — `ConversationProvider` + `useConversation` on `/claim`; `useScribe` on `/scribe`. Server: `@elevenlabs/elevenlabs-js` mints Scribe tokens; conversation start uses raw `fetch` to ElevenLabs (`/api/elevenlabs/token`, `/api/conversation/signed-url`). Agent create script registers **client** tools. Hosted conversation LLM defaults to **Gemini 2.0 Flash**; TTS is **eleven_flash_v2** (`scripts/create-elevenlabs-agent.ts`) |
| **Vision** | No vendor SDK. `src/lib/analyse.ts` uses raw `fetch`. **Local first:** `POST LOCAL_VISION_URL` `{ filename, mime_type, image_base64 }` (8s, raster only). The first file that returns findings **wins the whole claim** (`analyzer: "local_model"`). Cloud vision is then asked only to assign left/right/front/rear areas (no-ops if no key); findings stay `source: "local_model"` with `usedVisionModel: true` when locate succeeds. **If local misses every file:** one exclusive cloud provider (`LLM_PROVIDER`, else OpenAI key then Anthropic) — OpenAI-compatible `POST {OPENAI_BASE_URL}/chat/completions` (default model `gpt-4o-mini`; DeepSeek disables thinking) or Anthropic Messages `claude-sonnet-4-5`. Free-text lines are regex-mapped to damage-map areas. **Else** filename heuristic. SVG / non-raster skip both models |
| **Business rules** | In-process TypeScript: `src/lib/coverage.ts`, `src/lib/triage.ts`, `src/lib/estimate.ts`. No rules engine |
| **Validation** | Manual TypeScript helpers on `Record<string, unknown>` in `src/lib/tools.ts`. **Zod is not imported anywhere in `src/`** |
| **Auth** | None. Claims APIs use permissive CORS for the demo (`src/lib/cors.ts`) |
| **Object store / queue / cache** | None. Evidence bytes live in Postgres `bytea` |
| **Unit / API tests** | Vitest **3** (`src/lib/*.test.ts`, `src/app/api/api.integration.test.ts`) |
| **Page tests** | Playwright (`e2e/pages.spec.ts`) |
| **Lint** | ESLint 9 flat config + `eslint-config-next` (core-web-vitals + TypeScript) |
| **Package manager** | npm (`package-lock.json`) |
| **CI** | GitHub Actions (`.github/workflows/ci.yml`) |
| **Deploy** | Render Blueprint (`render.yaml`) or Vercel (`vercel.json`) |

One Next.js app talks to Postgres. There is no FastAPI service, Redis, or separate claims worker.

## Prerequisites

- **Node.js 20 or higher** (22 recommended; `engines` in `package.json` is `>=20`)
- **npm** (comes with Node)
- **Docker Desktop** (or any Docker Engine) for local Postgres
- **Git**
- Optional for live voice: an [ElevenLabs](https://elevenlabs.io) account and Conversational AI agent
- Optional for live photo analysis: an OpenAI-compatible or Anthropic API key

Microphone, camera, and `getUserMedia` need `localhost` or **https**. A bare `http://192.168.x.x` LAN IP will fail silently. For a phone demo use the deployed URL or a tunnel.

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/Otto-Deviant1904/Claimaroo.git
cd Claimaroo
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment file

```bash
cp .env.example .env.local
```

Next.js and the Drizzle/seed scripts load `.env.local` then `.env`. The example file is enough to run schema, tools, APIs, seeded claims, and the officer workspace **without** voice or vision keys.

| Variable | Local default | Required to… |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://claims:claims@localhost:5432/claims` | Start the app and any DB test |
| `ELEVENLABS_AGENT_ID` | example public agent id | Start a live call on `/claim` |
| `ELEVENLABS_AGENT_PUBLIC` | `true` | Start a public agent without minting a token |
| `ELEVENLABS_API_KEY` | empty | Private agents, signed URLs, Scribe, `npm run agent:create` |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | empty | Live photo analysis (otherwise heuristic) |

Full table: [Environment variables](#environment-variables).

### 4. Start PostgreSQL

`docker-compose.yml` runs Postgres 16 as user/password/database `claims` on port **5432**, matching `.env.example`.

```bash
docker compose up -d
```

Check it is ready:

```bash
docker compose ps
# or
pg_isready -h localhost -p 5432 -U claims
```

If something else already binds `5432` on your machine, create a **gitignored** override (do not commit it):

```yaml
# docker-compose.override.yml
services:
  postgres:
    ports: !override
      - "5433:5432"
```

Then set `DATABASE_URL=postgres://claims:claims@localhost:5433/claims` in `.env.local`.

### 5. Push schema and seed

```bash
npm run db:push    # drizzle-kit push — creates tables from src/db/schema.ts
npm run db:seed    # 15 customers, policies POL-1001–POL-1015, claims CLM-DEMO-A/B/C
```

Or in one step: `npm run db:release` (push + seed). Seed is a no-op if customers already exist, unless you set `SEED_RESET=1`. It also refreshes `POL-1001` dates if today’s date falls outside the stored term, so Maya’s demo stay on cover.

Expected seed log:

```text
Seeded 15 customers, 3 demo claims (CLM-DEMO-A/B/C).
```

### 6. Run tests (optional but recommended)

```bash
npm test              # unit tests — no database
npm run test:api      # every API route — needs Docker Postgres + seed
npm run test:e2e      # Playwright pages — starts next dev itself
```

### 7. Start the app

```bash
npm run dev
```

This runs `next dev --hostname 0.0.0.0 --port 3000`. Open [http://localhost:3000](http://localhost:3000).

| Path | What you should see |
| --- | --- |
| `/` | Landing page — **Start a claim** → `/claim`, **Officer workspace** → `/claims` |
| `/claim` | Customer intake. Add at least one photo and a policy mobile, then start the call (voice keys required for a live session) |
| `/claims` | Officer inbox listing `CLM-DEMO-A`, `CLM-DEMO-B`, `CLM-DEMO-C` |
| `/claims/CLM-DEMO-A` | Decision-ready rear-end case (Maya Chen, POL-1001) |
| `/scribe` | ElevenLabs Scribe playground (needs `ELEVENLABS_API_KEY` for a live token; the page still renders without one). Not linked from the landing page |

Smoke the APIs without the UI:

```bash
curl -s http://localhost:3000/api/health
# {"ok":true,"service":"forward-2026-claims-agent"}

curl -s -X POST http://localhost:3000/api/tools/get_policy \
  -H 'Content-Type: application/json' \
  -d '{"policy_id":"POL-1001"}'

curl -s http://localhost:3000/api/claims

curl -s -X POST http://localhost:3000/api/tools/run_triage \
  -H 'Content-Type: application/json' \
  -d '{"claim_id":"CLM-DEMO-C"}'
# route must be "urgent"
```

Voice and vision keys are optional for this slice. Without them, tools, APIs, and seeded claims still work; `analyse_damage` uses a labelled filename heuristic.

## Architecture

### What actually runs

```
CUSTOMER                         OFFICER
   |                                |
   v                                v
 /claim                          /claims , /claims/[id]
 @elevenlabs/react               RSC → Postgres
 useConversation                 listInboxClaims / loadCasePack
 clientTools ──POST──► /api/tools/{name}
 photo bytes ──POST──► /api/evidence
   |                                |
   |         NEXT.JS SERVER         |
   |  executeTool()  tools.ts       |
   |  analyse / coverage / triage   |
   |  recordAudit()                 |
   +--------------+-----------------+
                  |
                  v
            POSTGRES 16
     customers, policies, claims,
     evidence (bytea), assessments,
     audit_events
```

ElevenLabs hosts the voice pipeline and the conversation LLM (Gemini 2.0 Flash by default in `scripts/create-elevenlabs-agent.ts`). It does **not** talk to Postgres. Tools are registered as **client** tools: ElevenLabs tells the browser to call a tool; the `/claim` page `POST`s `/api/tools/{name}` and returns `result` / `resultText` to the agent. That is why `localhost:3000` works for a live demo without a public webhook.

### Directory structure

```text
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Landing
│   │   ├── claim/                # Customer voice intake
│   │   ├── claims/               # Officer inbox + case (+ loading.tsx)
│   │   ├── scribe/               # Scribe playground
│   │   └── api/                  # HTTP API (see below)
│   ├── components/
│   │   ├── claim/                # Intake orb / call UI
│   │   ├── claims/               # Inbox + case workspace
│   │   └── landing/              # Landing carousel / read-more
│   ├── db/
│   │   ├── schema.ts             # Drizzle tables
│   │   ├── seed.ts               # Synthetic book + A/B/C claims
│   │   └── index.ts              # postgres.js + TLS for hosted URLs
│   └── lib/
│       ├── tools.ts              # executeTool + loadCasePack
│       ├── analyse.ts            # local detect (+ vision locate), or vision, or heuristic
│       ├── coverage.ts           # preliminary coverage rules
│       ├── triage.ts             # auto_path / human_review / urgent
│       ├── estimate.ts           # AUD severity bands
│       ├── audit.ts              # recordAudit
│       ├── claim-list.ts         # Officer inbox query (RSC, not the HTTP API)
│       ├── claim-view.ts         # Officer labels + damage zones
│       ├── to-claim-view.ts      # Case pack → officer view model
│       ├── format.ts             # IDs, money, date helpers
│       ├── agent-prompt.ts       # First message + system prompt
│       ├── demo.ts               # Demo scripts + tool param schema
│       ├── cors.ts               # Permissive CORS on claims HTTP APIs
│       └── types.ts              # Enums, StructuredFacts, TOOL_NAMES
├── scripts/
│   ├── create-elevenlabs-agent.ts
│   └── smoke-apis.sh
├── e2e/                          # Playwright
├── docs/                         # Specs, architecture, test plan
├── docker-compose.yml            # Local Postgres 16
├── drizzle.config.ts
├── render.yaml                   # Render Blueprint
├── vercel.json                   # syd1 + 60s API budget
└── .github/workflows/ci.yml
```

`chatgpt-claims-dashboard/` is a standalone static mock, not part of the Next.js app.

### Request lifecycle

**Voice intake**

1. Customer opens `/claim`, adds at least one photo (bytes stay in the browser), and fills the policy mobile.
2. Page calls `GET /api/elevenlabs/token`. If `ELEVENLABS_AGENT_PUBLIC=true` the response is `{ agentId }`; otherwise the server mints a conversation token.
3. `useConversation` connects. The agent’s first line identifies itself as AI and asks about safety (`AGENT_FIRST_MESSAGE` in `src/lib/agent-prompt.ts`).
4. The conversation LLM chooses a tool. ElevenLabs sends that call to the browser.
5. `clientTools[name]` posts to `/api/tools/{name}` → `executeTool()` in `src/lib/tools.ts` → Postgres → `recordAudit()` → JSON back to ElevenLabs.
6. When `create_claim` returns a real `claimId`, pending photos POST to `/api/evidence`. Photos added after that upload immediately. A photo with an `evidenceId` is never uploaded twice. Max 8 photos (`PHOTO_CAP`).
7. Typical tool order: `get_customer` → `get_policy` → `create_claim` → `update_claim` → `attach_evidence` → `analyse_damage` → `estimate_repair` → `run_coverage_check` → `run_triage` → `generate_summary`. The LLM chooses; the server enforces guardrails when those tools run.
8. If the call ends without `create_claim`, `/claim` **fallback-lodges**: `get_customer` by the typed mobile, `create_claim`, upload pending photos, then best-effort `analyse_damage` → `run_coverage_check` → `run_triage`. Live `/claim` uses `GET /api/elevenlabs/token` only — not `/api/conversation/signed-url`.

**Evidence analysis** (`src/lib/analyse.ts` `analyseDamage`). Never throws. Raster images only for models (`image/*` except SVG).

1. **Local detect.** For each file, `POST LOCAL_VISION_URL` with `{ filename, mime_type, image_base64 }`, 8s timeout. First non-empty local result **returns for the whole claim** — later files are not analysed.
2. **Vision locate (optional).** After a local hit, `visionAnalyse` is always called *with the local findings*. With no cloud key it returns null immediately. On success, `applyVisionLocations` rewrites `area` only. `analyzer` stays `"local_model"`; `usedVisionModel` becomes `true`. If locate fails, the local result is kept as-is (no heuristic fallback).
3. **Vision as primary.** Only if every file missed locally. One provider, not a cascade: `LLM_PROVIDER` or OpenAI-if-keyed else Anthropic. OpenAI-compatible `POST {base}/chat/completions` (default `https://api.openai.com/v1`, model `gpt-4o-mini`; DeepSeek base URLs send `thinking: { type: "disabled" }`) or Anthropic `POST https://api.anthropic.com/v1/messages` (`claude-sonnet-4-5`). Lines become findings via `areaFromVisionObservation` + severity keywords. `analyzer: "vision"`.
4. **Heuristic.** Filename keywords (`rear`, `dent`, `scrape`, …) if no local hit and no usable vision text.

**Coverage + triage** — pure functions. `runCoverageCheck` compares the claim to the policy record (`binding: false`). `runTriage` hard-codes `route: "urgent"` when `injuries` or `immediateDanger` is true; `not_covered` / `unclear` / conflicts / missing intake go to `human_review`. There is no auto-decline state.

**Officer review**

1. `/claims` is a server component: `listInboxClaims()` in `src/lib/claim-list.ts` queries Postgres (joins customers + policies). It does **not** call `GET /api/claims`. On DB failure it renders the inbox with an error string, not an HTTP 503.
2. `/claims/[id]` calls `loadCasePack` + `toClaimView` on the server. `GET /api/claims/{id}` is the same pack for curl/smoke, not what the page fetches.
3. Actions POST to `/api/claims/{id}/actions`: `approve_next_stage`, `request_information`, `escalate`, `override`.
4. `approve_next_stage` is the only code path that sets that status. Still not a settlement.

### Pages

| Route | Role |
| --- | --- |
| `/` | Marketing / product landing |
| `/claim` | Customer voice + photo intake |
| `/claims` | Officer inbox |
| `/claims/[id]` | Officer case: header plus Incident, Coverage, Evidence, Call transcript, Assessment (damage map), Risk & uncertainty, Recommended action, Actions, Audit |
| `/scribe` | Real-time transcription playground |

Customer-page notes (CSS isolation, photo queue, phone/https): [`SETUP.md`](SETUP.md).

### HTTP API

All routes live under `src/app/api/`. Snake_case tool params are canonical; camelCase aliases (`claimId`, `customerId`, …) are accepted. Tool POST also unwraps an ElevenLabs envelope `{ parameters, conversation_id }`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | `{ ok: true, service: "forward-2026-claims-agent" }` — Render health check |
| `GET` | `/api/status` | Booleans for ElevenLabs keys, `llm` (`openai` \| `anthropic` \| `null`), `localVision`, and `database` (`Boolean(DATABASE_URL)` — not a live ping) |
| `GET` | `/api/tools/{name}` | `{ tools }` — all 11 names (path ignored) |
| `POST` | `/api/tools/{name}` | Execute a tool. 200 `{ ok, result, resultText }` or 400 `{ ok: false, error }` |
| `GET` | `/api/claims` | Inbox rows, newest first. 503 `{ claims: [] }` if the DB is down |
| `OPTIONS` | `/api/claims` | 204 CORS preflight |
| `GET` | `/api/claims/{id}` | Full case pack. Evidence has `hasFile`, never raw `bytes`. 404 if missing |
| `POST` | `/api/claims/{id}/actions` | Officer actions (see above) |
| `POST` | `/api/claims/{id}/transcript` | Persist conversation transcript (max 400 entries) |
| `POST` | `/api/evidence` | Multipart `claimId` + `file`, max 10MB. Stores bytes in Postgres |
| `GET` | `/api/evidence/{id}/file` | Raw bytes, `Content-Disposition: inline` |
| `GET` | `/api/elevenlabs/token` | `{ agentId }` or `{ conversationToken }` |
| `GET` | `/api/conversation/signed-url` | Private-agent WebSocket URL (needs API key + agent id) |
| `GET` | `/api/scribe-token` | Single-use Scribe token |

Permissive CORS (`Access-Control-Allow-Origin: *`) is on the **claims HTTP APIs** only (`/api/claims`, `/api/claims/{id}`, actions, transcript). `/api/evidence` and `/api/tools` do not set CORS — the product UI is same-origin. There is no authentication. Do not treat this as an auth system.

### Agent tools

Implemented in `src/lib/tools.ts`. Every call writes one `audit_events` row.

| Tool | Writes? | Contract |
| --- | --- | --- |
| `get_customer` | No | Lookup by id, phone, email, or name. Miss → `{ found: false }` — never invent |
| `get_policy` | No | Lookup by policy id, customer, or registration. Miss → do not invent coverage |
| `create_claim` | Yes | Requires `customer_id` + `policy_id`. Status `intake` |
| `update_claim` | Yes | Merges incident fields and `structured_facts` |
| `attach_evidence` | Yes | Links an uploaded `evidence_id` to the claim |
| `analyse_damage` | Yes | Findings + preliminary estimate; `analyzer`: `local_model` \| `vision` \| `heuristic` |
| `run_coverage_check` | Yes | `label: "preliminary"`, `binding: false` |
| `run_triage` | Yes | Sets `route` and claim `status` |
| `estimate_repair` | Yes | AUD cents bands from severity, `binding: false` |
| `escalate_claim` | Yes | `urgent` if injury/danger language or `urgent: true` |
| `generate_summary` | Yes | Persists `claims.summary` |

### Guardrails (enforced in code, not only in the prompt)

| Guardrail | Where |
| --- | --- |
| Injury / immediate danger → `urgent` | `src/lib/triage.ts` |
| No auto-decline | `not_covered` / `unclear` → `human_review` |
| No invented customers or policies | `get_customer` / `get_policy` return `found: false` |
| Officer gate | Only `POST …/actions` + `approve_next_stage` |
| Full audit | `recordAudit()` inside `executeTool()` |
| AI disclosure | First spoken line identifies the assistant as AI |
| Preliminary labels | Coverage and estimates always `binding: false` |

### Database schema

```text
customers
├── id (text PK)                    e.g. CUST-MAYA
├── name, email, phone, address

policies
├── id (text PK)                    e.g. POL-1001
├── customer_id → customers
├── vehicle_make, vehicle_model, vehicle_year, registration, vehicle_colour
├── coverage_type                   comprehensive | third_party | third_party_fire_theft
├── excess_cents                    AUD cents
├── start_date, end_date            YYYY-MM-DD
├── status                          seed uses active | expired
└── relevant_rules                  jsonb { id, text }[]

claims
├── id (text PK)                    e.g. CLM-DEMO-A
├── customer_id, policy_id
├── status                          intake | awaiting_evidence | decision_ready |
│                                   human_review | urgent | approved_next_stage |
│                                   info_requested | closed
├── incident_time, location, narrative
├── structured_facts                jsonb (injuries, conflictingAccounts, …)
├── route                           auto_path | human_review | urgent
├── route_reason, confidence, flags
├── coverage_status, coverage_notes, coverage_rule_refs
├── recommended_action, summary, officer_notes
├── conversation_id, transcript
└── created_at, updated_at

evidence
├── id, claim_id
├── type, filename, mime_type
├── file_url                        /api/evidence/{id}/file
├── bytes                           bytea — not on disk
└── extracted_facts, analysis_confidence, analysis_limitations

assessments                         1:1 with claims
├── claim_id (PK)
├── damage_findings
├── estimate_low_cents, estimate_high_cents
├── assumptions, label ("preliminary"), missing_information

audit_events
├── id, claim_id (nullable on lookup tools)
├── timestamp, actor                agent | officer | system | customer
├── action, tool
└── inputs_summary, result_summary
```

`loadCasePack(claimId)` in `src/lib/tools.ts` assembles the case for `GET /api/claims/{id}` and the officer case page. The inbox list is a separate, lighter query (`listInboxClaims`).

### Seeded demo book

| Claim | Customer | Phone | Policy | Status / route | Why it exists |
| --- | --- | --- | --- | --- | --- |
| `CLM-DEMO-A` | Maya Chen | 0412 000 001 | POL-1001 comprehensive | `decision_ready` / `auto_path` | Happy path, complete photos |
| `CLM-DEMO-B` | Liam O'Brien | 0412 000 002 | POL-1002 comprehensive | `human_review` | Conflicting accounts preserved |
| `CLM-DEMO-C` | Priya Nair | 0412 000 003 | POL-1003 comprehensive | `urgent` | Injury safety override |

Spoken scripts for a live demo: `DEMO_SCENARIOS` in `src/lib/demo.ts`. Twelve further synthetic policyholders (`POL-1004`–`POL-1015`) exist for lookup, including third-party, expired, and luxury-excess variants.

Repair bands (`src/lib/estimate.ts`) are placeholders in AUD cents: minor $800–$1,800, moderate $2,500–$6,500, severe $8,000–$18,000, unknown / no findings $1,500–$9,000. Not a repairer quote. The worst finding severity wins.

### External dependency failure modes

| Missing / down | Effect |
| --- | --- |
| `DATABASE_URL` / Postgres | `GET /api/claims` → 503 empty list; other claim queries fail. Schema/tools cannot run |
| ElevenLabs key / agent id | `/claim` cannot start a live session. Tools, seed, and `/claims` still work |
| Vision keys and `LOCAL_VISION_URL` unset | `analyse_damage` uses filename heuristics, clearly labelled |
| Local model error / empty / non-raster | That file is skipped; if every file misses, cloud vision or heuristic runs |
| Cloud vision error after a local hit | Local findings are kept; areas are not remapped |
| Cloud vision error with no local hit | Filename heuristic. OpenAI failure does **not** retry Anthropic in the same call |
| Render free web instance | Spins down after 15 minutes of inactivity; first request is a cold start |

## Environment variables

Copied from [`.env.example`](.env.example). Next.js loads `.env.local`. Server-only keys must not be prefixed `NEXT_PUBLIC_` except the optional agent-id mirror.

### Required for a running app

| Variable | Description | How to get |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string | Local: docker-compose. Hosted: Render / Supabase / Neon **direct** URI on port **5432** with `sslmode=require`. Do **not** use the Supabase transaction pooler on **6543** |

### Required for live voice

| Variable | Description | How to get |
| --- | --- | --- |
| `ELEVENLABS_AGENT_ID` | Conversational AI agent id | Existing public id in `.env.example`, or `npm run agent:create` |
| `ELEVENLABS_AGENT_PUBLIC` | `true` → `/api/elevenlabs/token` returns `{ agentId }` and no API key is needed to start | Set `true` while the agent is public |
| `ELEVENLABS_API_KEY` | Server key (not needed for a public agent on `/claim`) | ElevenLabs dashboard. Needed for private agents, `/api/conversation/signed-url`, Scribe, and `npm run agent:create` |

### Optional

| Variable | Description | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` | Client fallback if the server id is unset | — |
| `LOCAL_VISION_URL` | Self-hosted damage classifier. `POST { filename, mime_type, image_base64 }`, 8s timeout | — |
| `OPENAI_API_KEY` | OpenAI-compatible vision | — |
| `OPENAI_BASE_URL` | Gateway origin | `https://api.openai.com/v1` |
| `OPENAI_VISION_MODEL` | Vision model id | `gpt-4o-mini` (DeepSeek: `deepseek-flash`) |
| `ANTHROPIC_API_KEY` | Anthropic vision | — |
| `LLM_PROVIDER` | `openai` \| `anthropic` | `openai` if that key is set, else `anthropic` |
| `SEED_RESET` | `1` replaces all seed data | unset (skip if customers exist) |
| `PORT` | HTTP port | Next.js / Render inject this. `npm start` binds `0.0.0.0` |

**DeepSeek example** (OpenAI-compatible):

```bash
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_VISION_MODEL=deepseek-flash
LLM_PROVIDER=openai
```

AgentRouter credits are **not** supported (they reject non–Claude-Code clients).

`src/db/index.ts` enables TLS for `*.render.com`, `*.supabase.co`, `*.supabase.com`, `*.neon.tech`, or `sslmode=require`. Localhost stays unencrypted. Hosted pools use `max: 3` connections so Vercel lambdas do not exhaust a session pooler.

### Environment-specific examples

**Development**

```bash
DATABASE_URL=postgres://claims:claims@localhost:5432/claims
ELEVENLABS_AGENT_ID=agent_4301m2aeyrxterxa6h7vc2bnmx9e
ELEVENLABS_AGENT_PUBLIC=true
```

**Production (Render Blueprint)**

`DATABASE_URL` is wired from the Blueprint database. Fill voice/vision keys in the dashboard when prompted. Leave vision blank and analysis still works via heuristics.

**Production (Vercel + hosted Postgres)**

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require
ELEVENLABS_AGENT_ID=...
ELEVENLABS_AGENT_PUBLIC=true
```

Then run schema + seed **once** against that URL:

```bash
DATABASE_URL='postgresql://…?sslmode=require' npm run db:release
```

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server on `0.0.0.0:3000` |
| `npm run build` | Production build |
| `npm start` | `next start --hostname 0.0.0.0` (honours `$PORT`) |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests in `src/lib` (no database) |
| `npm run test:watch` | Vitest watch on `src/lib` |
| `npm run test:api` | API integration tests (needs `DATABASE_URL` + seed, 30s timeout) |
| `npm run test:e2e` | Playwright (starts `npm run dev` unless a server is already up) |
| `npm run test:all` | unit + api + e2e |
| `npm run smoke` | `BASE_URL=https://…` curl checks against a deployed host |
| `npm run db:push` | `drizzle-kit push` — apply `src/db/schema.ts` |
| `npm run db:seed` | Run `src/db/seed.ts` |
| `npm run db:release` | push + seed (Render pre-deploy) |
| `npm run db:studio` | Drizzle Studio |
| `npm run agent:create` | Register an ElevenLabs agent with the 11 **client** tools |

## Testing

### Running tests

```bash
# Unit — no Postgres
npm test

# One file
npx vitest run src/lib/triage.test.ts

# API routes — Docker Postgres must be up and seeded
npm run test:api

# Pages — Playwright Chromium; webServer = npm run dev
npx playwright install --with-deps chromium   # first time
npm run test:e2e

# Everything local
npm run test:all

# Deployed host
BASE_URL=https://your-host npm run smoke
```

CI (`.github/workflows/ci.yml`) runs three jobs on Node 22: unit, then API and e2e each against a `postgres:16` service with `npm run db:release`.

### Test layout

```text
src/lib/*.test.ts                         # coverage, triage, estimate, analyse, claim-view, claim-list, to-claim-view, demo
src/app/api/api.integration.test.ts       # every API route
e2e/pages.spec.ts                         # /, /claim, /claims, /claims/CLM-DEMO-A, /scribe
docs/test-plan.md                         # matrix + manual voice steps
```

Guardrails asserted in API tests:

- `CLM-DEMO-C` triage returns `route === "urgent"`
- Unknown customer → `found: false` (no invented person)
- `approve_next_stage` on a **new** claim is the action that sets that status

Playwright does **not** click Start the call or grant the microphone.

### Manual voice path

Needs `localhost` or https.

1. Open `/claim`, add a photo, allow the microphone, **Start the call**.
2. Speak as Maya Chen, `0412 000 001` (rear-end, nobody hurt). Script in `src/lib/demo.ts`.
3. End the call. The lodged view must show a Postgres `claimId`, not a client-minted id.
4. `/claims` shows the new row; `/claims/{id}` shows the photos.

Injury path: Priya Nair / `0412 000 003` should route urgent.

Out of CI: live WebRTC, files larger than Vercel Hobby’s ~4.5MB multipart cap (the app still allows 10MB; tests use a 1×1 PNG).

## Deployment

Evidence stays in Postgres. Do not write claim files to the container disk — Render and Vercel filesystems are ephemeral.

Phone and PC must open the **https Next.js origin** (`/claim`, `/claims`), not `*.supabase.co`. You can use Supabase **as the database**; do not host the Next app there.

### Render (primary)

[`render.yaml`](render.yaml) is a Blueprint: one Node web service (`claimaroo`) and Postgres 16 (`claimaroo-db`) in **Singapore**.

- Build: `npm ci --include=dev && npm run build`
- Pre-deploy: `npm run db:release` (schema push + seed if empty)
- Start: `npm start` → `next start --hostname 0.0.0.0` (binds `$PORT`)
- Health: `GET /api/health`
- Node 22

Steps:

1. Push the branch to GitHub.
2. Render dashboard → **New → Blueprint** → this repo.
3. Fill `ELEVENLABS_*` when prompted, or set `ELEVENLABS_AGENT_PUBLIC=true` with an agent id. Vision keys are optional.
4. First deploy seeds `CLM-DEMO-A/B/C`. Later deploys do **not** wipe demo data unless `SEED_RESET=1`.

Starter web + basic-256mb Postgres: pre-deploy is paid-only, and free web instances spin down after 15 minutes of inactivity.

### Vercel

[`vercel.json`](vercel.json) pins region `syd1` and a 60s budget on `src/app/api/**/*.ts` (Hobby plans may cap lower).

1. Import the GitHub repo.
2. Set `DATABASE_URL` to hosted Postgres (Supabase, Neon, or Render). Vercel does **not** provision Postgres.
3. Use `sslmode=require` and port **5432**, not the transaction pooler.
4. Set the same ElevenLabs vars as local.
5. Run `npm run db:release` once against that URL (from your laptop or a one-off).
6. Hobby multipart uploads are ~4.5MB. Keep demo photos small.

After it is live:

```bash
curl -s https://your-host/api/health
curl -s https://your-host/api/claims
BASE_URL=https://your-host npm run smoke
```

`GET /api/health` should be `{ ok: true }`. `GET /api/claims` should list `CLM-DEMO-A/B/C`.

### Docker (app)

There is no application `Dockerfile`. Local Docker is **Postgres only**. To containerise the Next app yourself: bind `0.0.0.0:$PORT`, pass `DATABASE_URL`, and keep evidence in Postgres.

### Creating a new ElevenLabs agent

```bash
# .env.local must contain ELEVENLABS_API_KEY
npm run agent:create
```

The script registers the 11 tools as `type: "client"`, voice `JBFqnCBsd6RMkjVDRZzb`, LLM `gemini-2.0-flash`. Copy the printed agent id into `ELEVENLABS_AGENT_ID` and, if you want a client fallback, `NEXT_PUBLIC_ELEVENLABS_AGENT_ID`. If the new agent is not public, unset `ELEVENLABS_AGENT_PUBLIC` and keep the API key.

## Troubleshooting

### Postgres will not accept connections

**Error:** `ECONNREFUSED` / `DATABASE_URL is not set`

1. `docker compose up -d` and wait for healthy.
2. Confirm the URL matches the published port (`5432` by default; `5433` only if you added a local override).
3. Copy `.env.example` to `.env.local` — Next and `tsx` seed scripts read that file.

### Seed skipped

**Log:** `Seed skipped: customers already present.`

That is intentional. To wipe and re-seed:

```bash
SEED_RESET=1 npm run db:seed
```

### Voice session will not start

- `/api/elevenlabs/token` returns 500 if `ELEVENLABS_AGENT_ID` is unset.
- Public agent: `ELEVENLABS_AGENT_PUBLIC=true` and a valid agent id. No API key required to start.
- Private agent: set `ELEVENLABS_API_KEY` and leave `ELEVENLABS_AGENT_PUBLIC` unset (or not `true`).
- Microphone requires `localhost` or https. Use the Render/Vercel URL on a phone.

### `analyse_damage` looks naive

No `LOCAL_VISION_URL` and no usable cloud response → filename heuristic (`source: "heuristic"`). That is expected. Check `GET /api/status` (`llm`, `localVision`). Seeded demo photos are SVGs, so local/cloud vision skip them (`isRasterImage` excludes SVG). AgentRouter *credits* reject non–Claude-Code clients; a generic OpenAI-compatible `OPENAI_BASE_URL` still works if the gateway accepts the key.

### Officer inbox is empty / database error

Postgres is down or `DATABASE_URL` is wrong. `/claims` still renders and shows an error in the inbox (`listInboxClaims` threw). `GET /api/claims` returns `{ claims: [], error }` with 503 for API clients.

### Vercel uploads fail around 4–5MB

Hobby multipart limit. Use a smaller photo or deploy the API on Render (app allows 10MB).

### Hosted Postgres / SSL / pooler

Use the **session** port **5432** and `sslmode=require`. Port **6543** (transaction pooler) is a common cause of prepared-statement and connection errors with `postgres.js`.

### Port 3000 already in use

`npm run dev` is hard-coded to port 3000 (Playwright `baseURL` is `http://localhost:3000`). Stop the other process or change both the script and `playwright.config.ts`.

### `npm run agent:create` exits 0 without creating an agent

`ELEVENLABS_API_KEY` is empty. The script prints setup steps and exits successfully so CI/local seed is not blocked.

## Further reading

| Document | Role |
| --- | --- |
| [`docs/technical-requirements.md`](docs/technical-requirements.md) | Locked engineering spec. Wins on conflict. |
| [`docs/system-architecture.md`](docs/system-architecture.md) | How the pieces fit (some routes still say `/call`; the live page is `/claim`). |
| [`docs/test-plan.md`](docs/test-plan.md) | API and page matrix. |
| [`SETUP.md`](SETUP.md) | Customer-page CSS, photo queue, phone/https. |
| [`docs/hackathon-proposal.md`](docs/hackathon-proposal.md) | Original Forward 2026 product proposal. |
| [`docs/handoff.md`](docs/handoff.md) | Early backend checkpoint notes (partially superseded by this README). |
| [`docs/prd-v3.md`](docs/prd-v3.md) | **Do not implement** — superseded FNOL-only PRD. |

## License

[MIT](LICENSE) — Copyright (c) 2026 Aayush Jain.

Synthetic contacts use `*.example.test`. Do not load real personal data into this prototype.
