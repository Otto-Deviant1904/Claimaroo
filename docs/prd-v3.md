> **Superseded.** Track 1 FNOL-only PRD (v3). The live product spec is [README.md](../README.md) (Forward 2026 Track 2 proposal).

# Voice-First-Motor-Claims-Intake-FNOL-with-Photo-Verification
A voice AI agent that takes First Notice of Loss (FNOL) for motor vehicle collision claims over the phone, extracts structured claim data in real time, accepts a damage photo from the claimant after the call, and cross-checks what was said against what the photo shows. Uncertain or contradictory information is flagged for human review.

---

# Product Requirements Document

**Voice-First Motor Claims Intake (FNOL) with Photo Verification**

- **Event:** Forward — AI in Business Hackathon
- **Track:** Track 1 — Improve an Existing Business Capability
- **Special Track:** Built With ElevenLabs
- **Build window:** 48 hours
- **Version:** 3.0

## 1. Summary

A voice AI agent that takes First Notice of Loss (FNOL) for motor vehicle collision claims over the phone, extracts structured claim data in real time, accepts a damage photo from the claimant after the call, and cross-checks what was said against what the photo shows. Uncertain or contradictory information is flagged for human review. The adjuster receives a completed, verified claim record instead of a raw call recording.

The agent does not assess, decide, or settle. It replaces the 6–7 minutes of manual data capture that currently sits in front of the adjuster's actual work. As an optional extension, the system can surface coverage and cost indicators to help an adjuster triage faster — framed explicitly as suggestions, never determinations.

## 2. Track alignment

**Track 1: Improve an Existing Business Capability.**

FNOL intake is not a new capability — every general insurer already does it, at scale, every day. What we improve is how it is done:

| | Today | With this system |
|---|---|---|
| Channel | Human call centre agent | Voice AI agent, 24/7 |
| Output | Free-text notes + recording, manually keyed into the claims system | Structured, validated claim record |
| Availability | Business hours + limited after-hours staffing | Always on, scales during high-volume events |
| Verification | Photos reviewed manually, later, by an adjuster | Photo cross-checked against the verbal account at intake |
| Quality signal | None until an adjuster opens the file | Confidence + conflict flags at intake |
| Triage | Adjuster reads the whole file to gauge complexity | Coverage/cost indicators pre-surfaced (optional) |

**Special Track alignment:** ElevenLabs Conversational AI is the core intake channel, integrated via SDK (not the no-code console) for dynamic per-turn context injection, function calling, and interruption handling. Remove the voice layer and there is no product.

## 3. Market context

This space is active, and the pitch should acknowledge that rather than claim novelty.

- **IAG × OpenAI (announced July 2026)** — customer-facing agentic voice for claims using OpenAI Presence, initially scoped to natural perils. Delivery expected H1 FY27. Closest comparable to this project.
- **Allianz "Project Nemo" (launched July 2025, Australia)** — seven specialised agents (Planner, Coverage, Weather, Fraud, Payout, Audit) automating food spoilage claims under AUD $500. 80% reduction in processing/settlement time; built in under 100 days. Critically, a human claims professional always makes the final payout decision. Allianz has stated it is extending the framework to motor lines.
- **IAG CASI** (Gen-AI claims assistant, ~500 intermediated claims staff since 2024) and **Crunchwork** (property claims workflow platform, adopted early 2026) — both staff-facing, not customer-facing voice.
- **Suncorp** — current tooling oriented to internal staff support and back-end automation.

**Where this project sits:** Nemo automates assessment of an already-submitted, low-complexity claim. This project improves intake of a higher-complexity one, with an optional lightweight step toward triage support. Even Nemo — automating a $500 food spoilage claim — keeps a human as sole payout authority; motor liability is a harder problem than food spoilage, and this project deliberately does not attempt it.

## 4. Business case

### Problem

- The initial FNOL call averages 6–7 minutes, with repeat calls frequently needed to collect information missed the first time.
- 85–95% of claims still go through a call centre despite years of digital investment.
- 47% of insurance enquiries occur outside standard business hours — many incidents queue overnight.
- Incomplete FNOL data is a leading cause of extended cycle times, rework, and leakage.

### Opportunity

- Auto customers acknowledged within 1 hour of FNOL are 80% less likely to complain.
- McKinsey research indicates digitised claims processes can cut handling costs up to 30%.
- Industry-wide straight-through processing sits below 10%; leading carriers reach ~35%. Clean structured capture at FNOL is the precondition.
- Average auto claim cycle time is 15–30 days; carriers at the low end share one trait — machine-readable data captured at FNOL.

### Value proposition

1. **Time** — intake handled without a human agent; adjuster receives a populated record.
2. **Availability** — after-hours and surge incidents captured immediately.
3. **Data quality** — required fields enforced at capture; contradictions flagged, not silently accepted.
4. **Verification** — photo evidence checked against the verbal account before an adjuster opens the file.
5. **Triage** — urgency (injury, vehicle undriveable) and, optionally, coverage/cost indicators surfaced at intake.

## 5. Scope

### 5.1 In scope

**Line of business:** Motor vehicle collision claims only. Highest volume, tightest standardised field set, no property valuation or contractor coordination. Depth over breadth.

**Capabilities:**

1. Inbound voice conversation handled end to end by an ElevenLabs Conversational AI agent
2. Real-time extraction of motor FNOL fields from the live transcript
3. Server-side dialogue state tracking — filled, missing, and uncertain fields
4. Dynamic question generation — the agent asks for what is genuinely still missing
5. Per-field confidence scoring and contradiction detection
6. Quote grounding — extracted values carry the verbatim source text
7. Post-call photo upload of vehicle damage
8. Damage severity classification from the photo
9. Cross-modal consistency check — verbal account vs. photo evidence
10. Escalation flagging for uncertainty or conflict
11. Adjuster dashboard: structured claim, transcript, photo, flags
12. Offline evaluation harness
13. (Optional) Coverage indicator against a mocked policy
14. (Optional) Rough repair cost band from photo severity

### 5.2 Out of scope

- Any claim type other than motor collision
- Claim assessment, liability determination, settlement
- Fault/liability determination of any kind — including partial or contributory fault
- Payout calculation or settlement figures
- Integration with a real policy administration or claims system (mocked lookup only)
- Real customer data of any kind
- Payments, repairer allocation, towing dispatch
- Identity verification beyond stated policy number
- Real SMS delivery (demo uses an on-screen link/QR code)
- Multi-photo galleries, video, or telematics input
- Native mobile app

### 5.3 Non-goals

- Not an autonomous claims handler. Every claim lands with a human.
- Not a fraud detection product. Inconsistency is flagged for attention, never alleged as dishonesty.
- Not a general-purpose insurance chatbot.
- Not a liability or fault-determination system, in any form.
- Not a settlement or payout calculator. Coverage and cost outputs (if built) are labelled recommendations, never decisions.

## 6. Users

**Primary — the claimant.** Has just had a collision. Possibly shaken, possibly roadside, possibly at 11pm. Wants to report it, know it is lodged, and know what happens next. Will not tolerate a long IVR tree or a web form.

**Secondary — the claims adjuster.** Opens the file later. Wants complete, trustworthy data and a clear signal about what needs checking — not a 7-minute recording to listen through.

## 7. Functional requirements

### 7.1 Claim schema

| Field | Type | Required | Critical | Source |
|---|---|---|---|---|
| `policy_number` | string | Yes | — | Voice |
| `driver_name` | string | Yes | — | Voice |
| `incident_datetime` | datetime | Yes | Yes | Voice |
| `location` | string | Yes | — | Voice |
| `collision_type` | enum (rear-end / intersection / parked / single-vehicle / other) | Yes | — | Voice |
| `other_vehicle_involved` | bool + optional rego | Yes | — | Voice |
| `injuries` | bool + severity | Yes | Yes | Voice |
| `vehicle_driveable` | bool | Yes | Yes | Voice |
| `fault_admission` | string (claimant's own words) | No | Yes | Voice |
| `witnesses` | bool | No | — | Voice |
| `photos_taken` | bool | No | — | Voice |
| `photo_damage_severity` | enum (minor / moderate / severe) | No | — | Photo |
| `photo_damage_location` | string | No | — | Photo |
| `verbal_photo_consistency` | bool | No | Yes | Derived |
| `coverage_indicator` (optional) | enum (appears_covered / needs_review) | No | — | Derived (rules) |
| `estimated_repair_cost_band` (optional) | enum (low / medium / high) | No | — | Derived (lookup) |

### 7.2 Field state object

Every field carries:

```json
{
  "value": null,
  "confidence": 0.0,
  "source_quote": null,
  "turns_asked": 0,
  "conflict": false
}
```

### 7.3 Dialogue state tracking loop

1. ElevenLabs webhook delivers the finalised transcript for a completed turn
2. LLM call with function calling extracts fields present, each with confidence and verbatim source quote
3. Merge into state:
   - Field empty → write value
   - New confidence ≥ existing → overwrite
   - New value conflicts with existing high-confidence value → set `conflict = true`, retain both
4. Compute remaining required fields
5. Select next question: highest-priority missing required field, or a targeted re-ask where `turns_asked >= 2` and confidence remains low
6. Inject the generated question into the agent's context for the next turn

**Note:** quotes must be taken from the finalised per-turn transcript, never the interim streaming hypothesis — STT revises partial output as more audio arrives.

### 7.4 Quote grounding

Interpretive fields (`fault_admission`, `injuries`, `collision_type`) store the verbatim claimant utterance alongside the classified value. Rationale:

- **Defensibility** — paraphrasing a fault admission is an interpretive leap the system should not make unilaterally
- **Hallucination control** — a value that cannot be grounded in an actual transcript span is itself a low-confidence signal
- **Auditability** — the adjuster can click a field and see the exact words behind it

Identity fields (`policy_number`, `driver_name`, dates) do not require quote grounding.

### 7.5 Photo capture and cross-modal check

Photos cannot arrive mid-call (audio channel only). Flow:

```
Call concludes → upload link surfaced (on-screen link/QR for demo)
→ claimant uploads one photo → severity classified
→ merged into the same claim state object
```

**Consistency check:** compare `photo_damage_location` against `collision_type` from the voice conversation. A rear-end claim showing front-end damage sets `verbal_photo_consistency = false` and triggers escalation through the existing conflict logic.

### 7.6 Confidence and escalation

- Critical field below 0.6 confidence → `escalate = true`
- Any field with `conflict = true` → `escalate = true`
- `verbal_photo_consistency = false` → `escalate = true`
- Escalation reason is stated explicitly (which field, what conflict) — never a generic "needs review" badge

### 7.7 Adjuster dashboard

- Structured claim record, fields colour-coded by confidence
- Live/complete transcript alongside
- Uploaded photo with classified severity and location
- Escalation panel listing specific low-confidence fields and detected conflicts
- Click-through from any grounded field to its source quote
- Call metadata: duration, timestamp, completion state
- (Optional) Coverage and cost band indicators, visually distinct from confirmed data — different colour/style, prefixed "Suggested:", never presented as fact

### 7.8 Evaluation harness

Runs independently of the voice layer — synthetic transcripts fed directly into the extraction pipeline as text, isolating reasoning-layer failures from speech-recognition failures.

Reports:

- Per-field extraction accuracy vs. hand-labelled ground truth
- Required-field completion rate
- Average per-turn latency
- Estimated cost per call
- Photo classifier accuracy on a held-out set
- Build-vs-buy comparison: trained classifier vs. zero-shot vision model on the same test images (accuracy, latency, cost)

### 7.9 Coverage and cost indicators (optional, Tier 5)

Two lightweight, rules-based additions — not model-driven decisions:

- **Coverage indicator:** checks the stated policy number against a small mocked policy table (covers collision: y/n, excess period active: y/n). Outputs `appears_covered` or `needs_review`. Pure lookup logic, no inference.
- **Repair cost band:** maps `photo_damage_severity` to a pre-set cost range (e.g. minor → $500–$2,000, moderate → $2,000–$8,000, severe → $8,000+) via a static lookup table, not a generated dollar figure.

**Hard constraints on this section:**

- Field names, UI labels, and any spoken/written description must use "indicator," "suggested," or "estimate" — never "decision," "approval," or "assessment"
- Neither output may influence escalation logic, routing, or any downstream automated action — they are read-only signals for a human
- If time-constrained, this entire section is the first thing to cut

## 8. Technical approach and key decisions

**Voice layer:** ElevenLabs Conversational AI Agents via SDK, for dynamic per-turn context injection and programmatic function-call schema definition.

**Transcript extraction:** LLM with function calling, returning field values, confidence, and source quotes.

**Why not train a transcript classifier?** Public insurance datasets are structured tabular records (claim amount, prior claims, demographics) and do not match free-text conversational transcript input — a model trained on them would not transfer. No labelled corpus of real motor FNOL transcripts is obtainable in the window. Few-shot prompted extraction is faster, more reliable, and inspectable.

**Why train a photo classifier?** Different situation entirely. Purpose-built labelled datasets exist (Car Damage Severity Dataset, VehiDE, and others on Kaggle), the task is a standard image classification problem, and transfer learning makes it tractable in hours. Prior open-source work on this exact task reached roughly 79% accuracy on damage location and 71% on severity using transfer learning on a pretrained backbone.

**Approach:** freeze a pretrained backbone (MobileNetV2 or ResNet18), fine-tune the classification head on a severity-labelled dataset. Colab free GPU tier is sufficient. Hard time-box; fall back to a zero-shot vision model call if it does not converge cleanly.

**Coverage and cost indicators:** deliberately rules-based, not model-based — static lookup tables, no LLM or trained model in this path. Keeps the "recommendation, not decision" boundary structurally enforced rather than relying on prompting or UI copy alone.

**Test data:** 6–8 hand-written synthetic motor collision transcripts with hand-labelled ground truth JSON — clean, vague, contradictory timeline, multiple fields in one utterance, high-urgency injury, off-script/rambling. Plus a small held-out set of damage photos.

## 9. Task breakdown — easiest to hardest

### Tier 1 — Foundational (do first, low risk)

1. **Define the claim schema in code** — the field list, types, enums, required/critical designations. Everything else depends on this existing.
2. **Write 6–8 synthetic transcripts** — plain text, covering the scenario spread above. No code required.
3. **Hand-label ground truth JSON** for each transcript. Tedious but trivial, and unblocks all evaluation.
4. **Repo, environment, and API key setup** — ElevenLabs, LLM provider, database.
5. **Database schema and storage layer** — claims table, field state as JSON, transcript storage.

### Tier 2 — Core build (the working spine)

6. **Single-shot extraction function** — transcript text in, structured fields out via function calling. Test against the synthetic transcripts only; no voice yet.
7. **Add confidence scoring and quote grounding** to the extraction output. Incremental change to the same function.
8. **Basic ElevenLabs agent** — static prompt, completes a call, delivers transcript. No dynamic questioning yet.
9. **Webhook receiver** — accepts finalised turn transcripts from ElevenLabs, writes to storage.
10. **Dashboard shell** — displays a stored claim record and transcript. Static read, no live updates.

### Tier 3 — The differentiating layer

11. **State merge logic** — fill/overwrite/conflict rules across turns. First genuinely non-trivial piece.
12. **Missing-field computation and question selection** — which field to ask for next, and when to re-ask.
13. **Dynamic context injection** — feed the generated question back into the agent for the next turn. Closes the loop; this is the technical core of the project.
14. **Escalation logic** — thresholds, conflict triggers, explicit reason strings.
15. **End-to-end integration** — live call flowing through to a populated dashboard. Expect this to take longer than estimated.

### Tier 4 — Depth and evidence

16. **Evaluation harness** — automated run over synthetic transcripts, accuracy/latency/cost reporting.
17. **Photo upload flow** — link/QR, upload endpoint, storage, dashboard display.
18. **Zero-shot vision classification of the photo** (fast path — gets the feature working before any training).
19. **Cross-modal consistency check** — photo damage location vs. verbal collision type.
20. **Train the damage severity classifier** — dataset acquisition, transfer learning, evaluation. Hard time-box.
21. **Build-vs-buy comparison** — trained classifier vs. zero-shot vision on held-out images.

### Tier 5 — Polish and optional extensions (only if genuinely ahead)

22. **Interruption/turn-taking tuning** — agent yields when the claimant speaks over it.
23. **Mocked policy lookup** validating the stated policy number.
24. **Coverage indicator** — rules-based check against the mocked policy, labelled as a suggestion.
25. **Repair cost band** — static lookup from photo severity, labelled as an estimate.
26. **Multilingual intake** (Cantonese / Mandarin).

**Sequencing note:** Tiers 1–3 constitute a complete, demonstrable product. Everything from Tier 4 onward is additive on top of a system that already works. If time runs short, a clean Tier 3 demo beats a half-broken Tier 4 or 5 one — and Tier 5's coverage/cost indicators are the first thing to drop if the schedule slips.

## 10. Success criteria

**Must have (demo-critical):**

- Live call completes end to end: voice → extraction → state → dashboard
- Agent asks for missing fields dynamically rather than reading a fixed script
- At least one escalation flag demonstrably triggered by conflicting or uncertain input
- Evaluation harness produces real measured numbers

**Should have:**

- Contradiction detection across non-adjacent turns
- Photo upload and cross-modal consistency check working
- Trained damage classifier with build-vs-buy comparison

**Could have:**

- Interruption handling tuned
- Multilingual intake
- Coverage indicator and repair cost band, clearly labelled as suggestions

**Demo success:** a judge can interrupt the scripted flow — give a vague answer, contradict themselves, upload a photo that does not match their account — and watch the system notice and respond appropriately.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Live demo fails (network, latency, mic) | Pre-recorded backup video; eval numbers stand independently of a live call |
| Per-turn LLM latency breaks conversational feel | Extraction runs async; agent acknowledges while processing |
| Photo classifier fails to converge in the time box | Zero-shot vision fallback already built at Tier 4 step 18 |
| Scope creep into other claim types | Motor-only is a locked constraint, not a starting point |
| Over-flagging (everything escalates) | Tune thresholds against the eval set, not by feel |
| Integration takes longer than expected | Tiers 1–3 deliberately sequenced to produce a working demo before any Tier 4/5 work begins |
| Coverage/cost indicator misread as a determination | Rules-based (not model-based) implementation, explicit "suggested/estimate" labelling everywhere, no influence on escalation or routing |

## 12. Ethical and governance considerations

- **Human in the loop by design.** The system never closes, denies, or assesses a claim. This mirrors the governance benchmark set by Allianz's Nemo, where a claims professional retains final payout authority even on a $500 automated claim.
- **No fraud allegations.** Inconsistency flags route for human review and are framed as such. An inconsistent account is not evidence of dishonesty — distressed claimants frequently give one.
- **Disclosure.** The agent identifies itself as an AI assistant at call open.
- **Escalation path.** The claimant can request a human at any point.
- **Photo evidence is corroborative, not determinative.** A cross-modal mismatch prompts human review; it never independently affects claim outcome.
- **Coverage and cost indicators, if built, are recommendations only.** Rules-based, clearly labelled, with no downstream automated effect — the same discipline applied consistently, not a carve-out.
- **Synthetic data only.** No real policyholder data at any stage of the build.
