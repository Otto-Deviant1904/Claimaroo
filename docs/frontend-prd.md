# Frontend PRD — Officer Dashboard (Slice 3)

Status: draft, for review. Scope is the officer-facing UI only. Voice UI (`/call`, Slice 2) is deferred to a later session; its locked requirements already live in [`technical-requirements.md`](technical-requirements.md) R6 and are not repeated here.

Nothing in the backend changes for this slice. Every page below is a read/write view over APIs and tables that already exist (`src/lib/tools.ts`, `src/db/schema.ts`, `src/app/api/claims/**`). No new endpoints, no new DB columns — the car/person diagrams described below are computed client-side from data that's already stored (`damage_findings[].area`, `structured_facts.injuries`, `structured_facts.injuryDescription`).

## 1. Goal

Give a claims officer a single screen per claim that shows everything the AI agent captured, checked, and is unsure about — and the buttons to move the claim forward — without replaying a call transcript. Damage and injury should be scannable at a glance, not just read as a bullet list.

## 2. In scope

| Route | Purpose |
|---|---|
| `/claims` | Inbox — every claim, newest updated first |
| `/claims/[id]` | Case view — the 9-panel workspace below |

## 3. Out of scope (this slice)

- `/call` voice page and anything ElevenLabs-related
- Evidence **upload** UI (upload already happens via `/call` in Slice 2; this dashboard only *displays* evidence already attached)
- SMS/email "send a link to your phone" upload flow
- Any new backend logic, schema change, or AI/model change
- A **back view** of the car or person diagram (front/top only — see §6)

## 4. `/claims` — Inbox

Server-rendered list, newest `updatedAt` first. Same data as `GET /api/claims`.

```
 Officer workspace
 Claims inbox · 3 claims
┌───────────────────────────────────────────────────────────┐
│ CLM-DEMO-A   [auto_path]  [decision_ready]                 │
│ Maya Chen · POL-1001 · George Street          Updated 2m   │
├───────────────────────────────────────────────────────────┤
│ CLM-DEMO-B   [human_review]                                │
│ Liam O'Brien · POL-1002              Flags: conflicting…   │
├───────────────────────────────────────────────────────────┤
│ CLM-DEMO-C   [urgent]                                       │
│ Priya Nair · POL-1003        Flags: escalated, injury…      │
└───────────────────────────────────────────────────────────┘
```

Each row: claim ID (monospace), status badge, route badge, customer name + policy ID, location if known, flags if any, last-updated timestamp. Click → `/claims/[id]`. Empty state: "No claims yet. Seed the database with `npm run db:seed`." DB-error state: show the error text, empty list, no crash.

*(Open question §9.1 — card list vs. dense table — still unresolved; sketch above assumes cards.)*

## 5. `/claims/[id]` — Case view layout

Two-column grid on desktop, single column on mobile. Header spans full width; Actions and Audit span full width at the bottom so the officer's next step is never squeezed into a side column.

```
┌─────────────────────────────────────────────────────────────┐
│ ← Claims inbox        CLM-DEMO-C   [urgent]                 │
│ Priya Nair (CUST-PRIYA) · POL-1003 · comprehensive           │
│ 2024 Toyota Corolla ABC-123        Created … · Updated …    │
└─────────────────────────────────────────────────────────────┘
┌───────────────────────────┐   ┌───────────────────────────┐
│ Incident                   │   │ Assessment                 │
│  ┌───────┐  Neck pain;     │   │  ┌───────┐  rear bumper:   │
│  │person │  ambulance      │   │  │  car   │  moderate       │
│  │diagram│  requested       │   │  │diagram│  paintwork:      │
│  └───────┘                 │   │  └───────┘  (unplaced)      │
│  Location, time, narrative │   │  Est. range (preliminary)  │
├───────────────────────────┤   ├───────────────────────────┤
│ Coverage                   │   │ Risk & uncertainty         │
├───────────────────────────┤   ├───────────────────────────┤
│ Evidence                   │   │ Recommended action         │
└───────────────────────────┘   └───────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ Actions  [Approve] [Request info] [Escalate] [Override ▾]   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ Audit  (newest first)                                        │
└─────────────────────────────────────────────────────────────┘
```

## 6. Damage & injury diagrams

Both diagrams are **flat 2D outlines**, not 3D/photoreal — simple SVG shapes divided into named zones. A zone lights up only when the claim's own data confidently maps to it. If nothing maps, the diagram stays neutral and the raw text is shown next to it instead of guessing — this follows the same "unknown stays unknown, do not invent" rule the rest of the product already enforces (technical-requirements.md R7.2).

### 6.1 Car damage diagram — lives in the **Assessment** panel

Top-down outline, paired with the existing damage-findings list (the diagram is a visual index into that list, not a replacement for it).

```
              FRONT
        ┌───────────────┐
        │   windscreen   │
  L-hdlt├───────────────┤R-hdlt
        │                │
        │      ROOF      │
        │                │
 L-side ├───────────────┤ R-side
        └───────────────┘
              REAR
```

Zones: `front`, `rear`, `left side`, `right side`, `windscreen`, `roof`, `left headlight`, `right headlight`.

Each `damage_findings[]` entry has a free-text `area` (from the vision model or the filename heuristic in `analyse.ts`) — matched to a zone by keyword:

| Zone | Matches area text containing |
|---|---|
| Front | `front`, `bumper` + `hood`/`bonnet`, `grille` |
| Rear | `rear`, `bumper` + `boot`/`trunk`, `taillight` |
| Left / right side | `side panel`, `door` + explicit `left`/`right`/`driver`/`passenger` |
| Windscreen | `windscreen`, `windshield`, `glass` |
| Headlights | `headlight`, `light cluster` |
| Roof | `roof` |
| *(unplaced)* | anything else — e.g. `paintwork`, `unspecified`, `body panel` with no side stated |

Zone fill color = highest-severity finding in that zone: minor = yellow, moderate = orange, severe = red, unknown = grey dashed outline. Hovering/tapping a lit zone shows the observation text and source (`vision`/`heuristic`/`customer`). Findings that can't be placed (no side/position in the text) are listed as plain text under the diagram, not pinned to a guessed zone.

**Worked example — `CLM-DEMO-A`** (real seed data): findings are `rear bumper` (→ Rear zone lights up, moderate/severe per seed) and `paintwork` (→ no zone match, listed as text below the diagram). This is the concrete case that proves the fallback path matters — "paintwork" alone doesn't say where.

**Worked example — `CLM-DEMO-B`**: finding is `side panel` with no left/right stated → also falls to the unplaced list, since the seed text doesn't specify a side.

### 6.2 Person injury diagram — lives in the **Incident** panel

Front-facing outline only (no back view — noted as a limitation, not built this slice).

```
            ( head )
              |
          [  neck  ]
        /------------\
   L   |    chest     |   R
  arm  |--------------|  arm
       |   abdomen    |
        \------------/
         |         |
       L leg      R leg
```

Zones: `head`, `neck`, `chest`, `abdomen`, `left arm`, `right arm`, `left leg`, `right leg`.

Driven by `structured_facts.injuries` and `structured_facts.injuryDescription`, with three distinct states — collapsing `null` into "no" would violate the product's own "unknown stays unknown" rule, so all three render differently:

| `injuries` value | Diagram state |
|---|---|
| `false` | Neutral outline, small "No injuries reported" note, no highlight |
| `null` / not yet asked | Neutral outline, "Not yet established" note — visually distinct from "false" (e.g. dashed vs. solid outline) |
| `true` | Keyword-match `injuryDescription` against the zone table below; matched zone highlighted red. If no keyword matches (empty or non-specific description), show a red "Injury reported — location not specified" banner **above** the diagram instead of guessing a zone, and print the raw description text underneath |

| Zone | Matches description text containing |
|---|---|
| Head | `head`, `concussion`, `face` |
| Neck | `neck`, `whiplash` |
| Chest | `chest`, `rib` |
| Abdomen | `abdomen`, `stomach` |
| Arms | `arm`, `wrist`, `shoulder`, `hand` (+ `left`/`right` if stated, else both arms shown at lower-intensity highlight) |
| Legs | `leg`, `knee`, `ankle`, `foot` (+ `left`/`right` if stated, else both legs at lower-intensity highlight) |

**Worked example — `CLM-DEMO-C`** (real seed data): `injuries: true`, `injuryDescription: "Neck pain; ambulance requested"` → Neck zone highlighted red, tooltip shows the full description text.

**Worked example — `CLM-DEMO-A` / `CLM-DEMO-B`**: `injuries: false` → neutral outline, "No injuries reported."

## 7. Panel-by-panel spec

### Panel 1 — Claim header
Claim ID, status badge, route badge, customer name + ID, policy ID + coverage type, vehicle (year/make/model/rego), created/updated timestamps.

### Panel 2 — Incident
Person injury diagram (§6.2) alongside incident time, location, free-text narrative, and every **non-null** field from `structured_facts` (emergency services, other vehicles, at-fault statement, conflicting accounts, weather, police notified, passengers, airbags, vehicle drivable, incident type). Null fields are omitted, not shown as "—".

### Panel 3 — Coverage
Policy's own fields: coverage type, excess (AUD), policy status, policy period. Then the coverage check result: status badge, always labeled **preliminary**, notes text, and the specific policy rule text (not just IDs) for any `coverage_rule_refs`.

### Panel 4 — Evidence
Grid of uploaded files: inline image if raster + bytes exist, else a placeholder box with mime type; filename; upload timestamp; analysis confidence badge; limitations text if present. Empty state: "No evidence uploaded yet."

### Panel 5 — Assessment
Car damage diagram (§6.1) alongside the estimate range (AUD, always labeled preliminary/suggested), the damage-findings list, assumptions, and missing-information (warning tone — it means the estimate is incomplete). Empty state: "No assessment yet."

### Panel 6 — Risk & uncertainty
Flags as badges. Confidence level. Route reason. Conflicting-accounts state shown as explicit "Unknown" when never captured — never silently rendered as "No".

### Panel 7 — Recommended action
The system's `recommended_action` text, with a persistent "non-binding — preliminary system suggestion only" line underneath regardless of content.

### Panel 8 — Actions (interactive, client-side)
Buttons post to `POST /api/claims/[id]/actions`:
- **Approve next stage** → `{ action: "approve_next_stage" }`
- **Request information** → `{ action: "request_information", note }`
- **Escalate** → `{ action: "escalate", note }`
- **Override** → `{ action: "override", status?, route? }` via two dropdowns (`CLAIM_STATUSES` / `TRIAGE_ROUTES`), enabled only when one is chosen

A shared note textarea feeds Request Info and Escalate. Successful action → page refresh so every panel reflects new state. Errors surface inline, never a browser `alert()`.

### Panel 9 — Audit
Every `audit_events` row, newest first: timestamp, actor badge, action name, result summary. Empty state: "No audit events yet."

## 8. Visual language

Reuse the existing look from `src/app/page.tsx` — zinc/neutral palette, Tailwind, Geist font, rounded cards with subtle borders/shadow. No new UI library beyond inline SVG for the two diagrams.

| Badge | Tone |
|---|---|
| `auto_path`, `approved_next_stage` | green |
| `human_review`, `info_requested`, flags | amber |
| `urgent`, injury highlight | red |
| `decision_ready` | blue |
| `intake`, `awaiting_evidence`, `closed`, actor tags | neutral gray |
| Unmatched/unknown diagram zone | grey, dashed |

## 9. Acceptance criteria

Seeded `CLM-DEMO-A` / `B` / `C` must each open at `/claims/[id]` **without a live call**, with all 9 panels present (even if empty).

- `CLM-DEMO-A` (auto_path): green route badge; car diagram lights up Rear (moderate/severe), "paintwork" listed as unplaced; person diagram neutral, "No injuries reported."
- `CLM-DEMO-B` (human_review): amber badge; `conflicting_accounts` visible in Risk panel; car diagram's "side panel" finding listed as unplaced (no side stated in seed data).
- `CLM-DEMO-C` (urgent): red badge; person diagram lights up Neck with the ambulance/neck-pain text; recommended action reflects the safety override.

Officer actions must actually change state: Approve updates the status badge after refresh; Escalate moves route to `human_review`/`urgent` and adds an audit row.

## 10. Implementation notes (non-binding, for scoping only)

Roughly 8 files instead of the original 6: the 2 pages, the actions client component, 3 shared UI helpers (badge/panel/key-value), plus 2 new presentational components (`car-diagram.tsx`, `person-diagram.tsx`) and one small shared zone-matching helper (`src/lib/diagram-zones.ts`) implementing the keyword tables in §6. All client-side; no backend touched.

## 11. Open questions for you to confirm

1. Card list vs. table for `/claims` inbox — this draft assumes cards.
2. Evidence panel: download link for non-image files (PDFs), or is a placeholder box enough for this slice?
3. Shared note textarea across Request Info / Escalate, or a separate field per action?
4. **New**: when a car-diagram finding can't be placed on a zone (e.g. "paintwork"), is a plain text list under the diagram enough, or do you want a small unplaced marker floating off to the side of the outline?
5. **New**: for injuries with no clear body-part keyword, is the red banner ("location not specified") the right call, or would you rather highlight the whole silhouette faintly instead of using a banner?

---

Once you're happy with this, I'll build to this spec.
