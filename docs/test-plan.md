# Test plan

Automated coverage lives in Vitest (unit + API) and Playwright (pages). A live ElevenLabs call is **manual**. Voice stays on `@elevenlabs/react`; this plan does not use the Vercel AI SDK.

| Layer | Command | Needs Postgres |
|---|---|---|
| Unit | `npm test` | no |
| API routes | `npm run test:api` | yes (`DATABASE_URL`, seeded) |
| Pages | `npm run test:e2e` | yes (Playwright starts `next dev`) |
| All local | `npm run test:all` | yes |
| Deployed host | `BASE_URL=https://… npm run smoke` | remote DB already migrated |

CI: `.github/workflows/ci.yml` runs unit, then API and Playwright against `postgres:16`.

---

## API matrix

| Method | Path | Automated | Happy path | Error path |
|---|---|---|---|---|
| GET | `/api/health` | `test:api` | 200 `{ ok: true, service: "forward-2026-claims-agent" }` | — |
| GET | `/api/status` | `test:api` | 200 booleans + `llm` + `database` | — |
| GET | `/api/tools/{name}` | `test:api` | 200 `{ tools }` includes all 11 names | — |
| POST | `/api/tools/get_customer` | `test:api` | `phone: "0412000001"` → `found: true` (Maya) | unknown name → `found: false`, no invented customer |
| POST | `/api/tools/get_policy` | `test:api` | `POL-1001` → `found: true` | bad id → `found: false` |
| POST | `/api/tools/create_claim` | `test:api` | Maya + `POL-1001` → `claimId` | missing ids → 400 |
| POST | `/api/tools/update_claim` | `test:api` | merge `location` on new claim | missing claim → 400 |
| POST | `/api/tools/attach_evidence` | `test:api` | attach uploaded `evidence_id` | missing claim → 400 |
| POST | `/api/tools/analyse_damage` | `test:api` | heuristic on new claim | missing claim → 400 |
| POST | `/api/tools/run_coverage_check` | `test:api` | new claim | missing → 400 |
| POST | `/api/tools/run_triage` | `test:api` | `CLM-DEMO-A` → `auto_path`; `CLM-DEMO-C` → `urgent` | missing → 400 |
| POST | `/api/tools/estimate_repair` | `test:api` | `CLM-DEMO-A` | missing → 400 |
| POST | `/api/tools/escalate_claim` | `test:api` | new claim | missing → 400 |
| POST | `/api/tools/generate_summary` | `test:api` | `CLM-DEMO-A` | missing → 400 |
| POST | `/api/tools/not_a_tool` | `test:api` | — | 400 `{ ok: false }` |
| POST | `/api/tools/get_customer` envelope | `test:api` | `{ parameters, conversation_id }` unwraps | — |
| GET | `/api/claims` | `test:api` | includes `CLM-DEMO-A/B/C` | 503 `{ claims: [] }` if DB down (manual/optional) |
| OPTIONS | `/api/claims` | `test:api` | 204 CORS | — |
| GET | `/api/claims/CLM-DEMO-A` | `test:api` | pack; evidence has `hasFile`, no `bytes` | — |
| GET | `/api/claims/missing` | `test:api` | — | 404 |
| POST | `/api/claims/{id}/actions` | `test:api` | `approve_next_stage`, `request_information`, `override`, `escalate` on a **new** claim (not DEMO-A) | `action: "nope"` → 400 |
| POST | `/api/evidence` | `test:api` | tiny PNG → `evidenceId` | missing `claimId` / file; unknown claim 404 |
| GET | `/api/evidence/{id}/file` | `test:api` | 200 bytes after upload | unknown id 404 |
| GET | `/api/elevenlabs/token` | `test:api` | `ELEVENLABS_AGENT_PUBLIC=true` → `{ agentId }` | unset agent → 500 |
| GET | `/api/conversation/signed-url` | `test:api` | live ElevenLabs **not** called in CI | 503 if key/id missing |
| GET | `/api/scribe-token` | `test:api` | live **not** called in CI | 503 if key missing |

Guardrails asserted in API tests:

- `CLM-DEMO-C` triage returns `route === "urgent"`.
- `get_customer` miss does not invent a customer (`found: false`).
- `approve_next_stage` on a new claim is the action that sets `approved_next_stage`.

---

## Pages (Playwright)

| Route | Checks |
|---|---|
| `/` | Title contains Claimaroo; skip link; **Start a claim** → `/claim`; **Officer workspace** → `/claims` |
| `/claim` | Hint “Add at least one photo and keep the policy mobile filled in.”; Start has `aria-disabled`; empty mobile + photo keep Start disabled until mobile filled. Do **not** click Start or grant mic |
| `/claims` | Heading “Claims dashboard”; `CLM-DEMO-A` visible; **Home** → `/` |
| `/claims/CLM-DEMO-A` | Case id in header; **Approve next stage** present |
| `/scribe` | Heading “Talk naturally. See every word.” (no live scribe token) |

---

## Manual (voice)

Needs `localhost` or **https** (phone: Render/Vercel URL, not `http://192.168.x.x`).

1. Open `/claim`, add at least one photo, allow microphone, **Start the call**.
2. Speak as Maya Chen, `0412 000 001` (rear-end, nobody hurt).
3. End the call. Lodged view shows a real `claimId` (not a client-minted id).
4. `/claims` shows the new row; `/claims/{id}` has photos.

Injury path (optional): Priya Nair / `0412 000 003` should route urgent.

---

## Deploy smoke

After Render or Vercel is live:

```bash
BASE_URL=https://your-host npm run smoke
```

Hits health, status, claims list, `CLM-DEMO-A`, tools catalog, ElevenLabs token.

## Out of CI

- Live microphone / ElevenLabs WebRTC session
- Files larger than Vercel Hobby multipart limits (~4.5MB). App still allows 10MB; tests use a 1×1 PNG
