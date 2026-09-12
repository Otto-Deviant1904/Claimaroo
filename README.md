# Voice-First Motor Claims Agent

A voice-first AI claims employee that turns a messy customer conversation into a structured, evidence-backed, human-ready claims case.

---

**FORWARD 2026 — AI Claims Agent**

*From first conversation to a decision-ready claim.*

A 48-hour prototype proposal for the Forward AI in Business Hackathon.

| Submission | Positioning |
|---|---|
| Primary track | Track 2 — Create a New Business Capability |
| Additional entry | Special Track — Built With ElevenLabs |
| Core interface | Natural voice conversation |
| Core product | Agentic claims orchestration + human handoff |
| Primary demo | Motor vehicle accident claim |
| Build constraint | Convincing end-to-end prototype in 48 hours |

> Core thesis: We are not building an insurance chatbot. We are prototyping an AI employee that turns a messy customer interaction into structured work, evidence, analysis, and a human-ready claims case.

## 1. Executive Summary

Insurance claims begin with a conversation, but much of the operational work happens after that conversation: capturing structured details, validating policy information, collecting evidence, identifying missing information, assessing the incident, routing the case, and preparing a claims professional to make a decision. This creates delay for customers and repetitive work for staff.

The proposed product is a voice-first AI claims agent. A policyholder can describe an accident naturally rather than navigating a long form or waiting for a call-centre employee. The agent asks adaptive questions, retrieves policy information, requests evidence, analyses uploaded images or documents, creates a structured claim record, performs configurable business checks, and decides whether the case can proceed automatically or requires human review.

The key product insight is the handoff. When human judgment is required, the claims officer receives a decision-ready case rather than a transcript or a half-completed form. The system shows what happened, what evidence was collected, what policy information was checked, what the AI inferred, what remains uncertain, and why the case was routed for review.

Recommended judging narrative: Track 2 + ElevenLabs. The new capability is not merely automated call intake; it is an agent that can coordinate the work between first contact and human decision.

## 2. Why This Problem

### 2.1 Customer pain

A stressful event often starts with a customer who does not know what information the insurer needs.

Customers can be asked to repeat the same incident details across forms, calls, uploads, and follow-ups.

The claim may not progress until missing information is found and manually reconciled.

### 2.2 Insurer pain

Claims teams receive unstructured narratives that must be converted into structured records.

Employees spend time on repetitive intake and administration instead of higher-value judgment and exception handling.

Evidence can arrive in different forms: voice, text, photos, receipts, policy documents, and repair information.

The complexity of a claim is not known at the start, so routing and escalation matter.

### 2.3 Why AI is appropriate

This workflow combines exactly the capabilities that modern AI is becoming useful at: natural language interaction, multimodal understanding, retrieval over business data, structured extraction, tool calling, reasoning over rules, and workflow orchestration. Voice is especially valuable because the customer can explain the event in their own words while the system handles the structure.

## 3. Market Context and Strategic Implication

The idea is commercially relevant, but the team should not claim that conversational claims intake is unprecedented. The market has already moved toward voice FNOL and agentic claims automation. The competitive research therefore changes our differentiation strategy: we should demonstrate a broader workflow and a stronger human-agent operating model rather than present “voice claims intake” as the invention.

| Evidence | What it tells us | Implication for the hackathon |
|---|---|---|
| ElevenLabs insurance offering | ElevenLabs currently markets insurance agents for claims intake/FNOL, policy servicing, and structured handoffs. | Voice must be a core interface, but we need to go beyond “AI answers the phone.” |
| Guidewire Qusar (Aug 2026) | Guidewire describes voice-driven FNOL, direct claim capture, adjuster summaries, and an agentic framework connected to core insurance systems. | A simple FNOL demo is too close to an established category. |
| Allianz Australia (2026) | Allianz reports an agentic AI solution for food-spoilage claims with the potential to reduce processing and settlement time by around 80%. | Agentic automation in claims is a credible business direction, including in Australia. |
| Hackathon constraint | Judges will care about problem clarity, usefulness, technical execution, and demo quality more than production readiness. | Use a simulated insurer backend but make the agent actually execute tools and update state. |

Sources used for this assessment: ElevenLabs insurance AI and conversational insurance materials [1][2]; Guidewire Qusar release materials [3]; Allianz Australia innovation announcement [4]. Full links are listed in Section 17.

## 4. Product Definition

Product statement: A voice-first AI claims employee that takes an insurance claim from first conversation to a decision-ready case, while keeping humans in control of high-risk or ambiguous decisions.

### 4.1 What the product is

A conversational interface for the policyholder.

An agent capable of reading policy and claim data and writing to a claims workflow.

A multimodal evidence collector and analyst.

A triage and escalation layer that determines when human judgment is needed.

A claims officer workspace that exposes the AI’s work and uncertainty.

### 4.2 What it is not

Not a generic customer-service chatbot.

Not a replacement for licensed claims professionals.

Not an insurance pricing engine certified for production use.

Not a claim-denial engine.

Not a production integration with a real insurer during the hackathon.

## 5. Primary User Journeys

### 5.1 Journey A — Straightforward motor claim

Customer calls and says they were involved in a rear-end collision.

Agent checks safety: injuries, emergency services, immediate danger.

Agent authenticates or identifies the customer using mock policy data.

Agent gathers the minimum necessary incident details through adaptive conversation.

Agent retrieves the policy and explains relevant coverage and excess from the source record.

Agent asks the customer to upload damage photos and any available documents.

Vision/document analysis converts evidence into structured findings.

Agent runs configured business checks: coverage, completeness, risk flags, and routing.

Agent creates or updates the claim record and produces a structured case summary.

If the claim is within the prototype’s auto pathway, the system advances it; otherwise it routes to a claims officer with full context.

### 5.2 Journey B — Ambiguous claim

The customer gives conflicting or incomplete information. The agent explicitly marks uncertainty, asks targeted follow-ups, and routes the case for human review. The human sees the conflict rather than receiving a false confident answer.

### 5.3 Journey C — Safety or vulnerability escalation

The customer indicates serious injury, immediate danger, or another high-risk condition. The voice agent stops ordinary claim processing, provides an appropriate safety-oriented response, and escalates immediately. This is important for demonstrating that autonomy is bounded by policy.

## 6. Functional Requirements

| ID | Requirement | Priority | Acceptance test |
|---|---|---|---|
| FR-01 | Natural voice intake using ElevenLabs. | Must | A tester can complete a realistic accident conversation without manually filling a long form. |
| FR-02 | Dynamic questioning based on missing information. | Must | Agent asks follow-ups only where needed and updates structured state. |
| FR-03 | Policy retrieval. | Must | Agent retrieves a mock policy and cites relevant fields in the claim view. |
| FR-04 | Claim creation/update via tools. | Must | Conversation results in an actual persisted claim record. |
| FR-05 | Evidence upload and storage. | Must | Customer can upload at least one image/document and it is attached to the claim. |
| FR-06 | Multimodal evidence analysis. | Must | System extracts visible damage or key document facts with confidence/limitations. |
| FR-07 | Triage. | Must | Claim is routed to auto-path, human review, or urgent escalation based on explicit rules. |
| FR-08 | Human handoff summary. | Must | Claims officer sees a structured case summary with evidence and uncertainties. |
| FR-09 | Audit trail. | Should | System shows key actions/tools used and important state changes. |
| FR-10 | Claim status follow-up. | Should | Customer can ask what is happening with an existing claim. |
| FR-11 | Multilingual voice. | Stretch | Demonstrate one additional language where quality is strong enough for a clean demo. |
| FR-12 | Repair workflow integration. | Stretch | Prototype repair booking/estimate handoff as a downstream tool. |

## 7. Non-Functional Requirements and Guardrails

| Area | Requirement |
|---|---|
| Safety | Emergency/injury scenarios override normal workflow. |
| Accuracy | Do not invent policy coverage, claim facts, or damage findings. Unknown values remain unknown. |
| Human control | Final adverse or high-impact decisions remain with a human for the prototype. |
| Traceability | Important recommendations should be attributable to source data, rules, or observed evidence. |
| Privacy | Use synthetic customers, policies, and evidence only. Do not use real personal data. |
| Latency | Voice responses should feel conversational; long-running analysis can show a visible progress state. |
| Robustness | Agent should handle interruption, correction, or missing evidence without losing the claim state. |
| Scope control | Prototype should explicitly label estimates and model judgments as preliminary, not binding insurance decisions. |

## 8. System Architecture

The prototype should use a small number of reliable components rather than a complicated multi-agent framework. “Agentic” should describe the system’s ability to choose actions and execute tools, not the number of LLMs in the diagram.

```
CUSTOMER
   ↓
ELEVENLABS VOICE AGENT
   ↓
ORCHESTRATOR / LLM
   ├── Policy tools
   ├── Claims tools
   ├── Evidence tools
   ├── Vision/document analysis
   ├── Business-rule checks
   └── Escalation tools
   ↓
CLAIM STATE / DATABASE
   ↓
CLAIMS OFFICER DASHBOARD
```

### 8.1 Core components

| Component | Responsibility | Hackathon implementation |
|---|---|---|
| Voice layer | Real-time conversation and speech interaction. | ElevenLabs agent/voice stack. |
| Orchestrator | Maintains task state, chooses tools, asks next questions. | One strong LLM with tool calling. |
| Policy service | Returns policy details and coverage fields. | FastAPI/Node mock service backed by Postgres/Supabase. |
| Claims service | Creates and updates claim records. | Simple REST API. |
| Evidence service | Stores uploads and returns analysis. | Object storage + multimodal model. |
| Triage engine | Applies deterministic safety and routing rules around model outputs. | Explicit rule layer, not only prompt instructions. |
| Claims dashboard | Lets human review the prepared case and approve/escalate. | Next.js/React UI. |

## 9. Agent Tools and Contracts

The agent should have explicit tools so that the demo proves the AI can act on a business system rather than merely generate text.

| Tool | Inputs | Output |
|---|---|---|
| get_customer | customer identifier | customer profile |
| get_policy | policy identifier | coverage, excess, vehicle, status |
| create_claim | customer, incident data | claim ID |
| update_claim | claim ID, structured fields | updated claim |
| attach_evidence | claim ID, file reference | evidence ID |
| analyse_damage | evidence IDs | observations, confidence, limitations |
| run_coverage_check | policy + incident fields | coverage status + rule references |
| run_triage | claim state + evidence | route + reason + flags |
| estimate_repair | damage observations | preliminary range + assumptions |
| escalate_claim | claim ID, reason | human queue record |
| generate_summary | claim ID | decision-ready summary |

## 10. Prototype Data Model

| Entity | Key fields |
|---|---|
| Customer | id, name, contact, policy_ids |
| Policy | id, customer_id, vehicle, coverage_type, excess, start/end dates, relevant rules |
| Claim | id, customer_id, policy_id, status, incident_time, location, narrative, structured facts, route, confidence |
| Evidence | id, claim_id, type, file_url, extracted_facts, analysis_confidence |
| Assessment | claim_id, damage_findings, estimate_low, estimate_high, assumptions |
| AuditEvent | timestamp, actor, action, tool, inputs_summary, result_summary |

All data should be synthetic. Create 10–20 mock policyholders and 3–5 claims, with at least three deliberately distinct demo scenarios.

## 11. Demo Scenarios

| Scenario | What happens | Why it matters |
|---|---|---|
| A. Straightforward collision | Clear rear-end collision, valid comprehensive cover, complete photos. Claim becomes decision-ready. | Shows the happy path and end-to-end automation. |
| B. Ambiguous liability | Customer account conflicts with incident narrative or evidence. Agent flags uncertainty and routes to human. | Shows honesty, uncertainty handling, and meaningful human oversight. |
| C. Injury / urgent escalation | Customer mentions injury or immediate safety risk. Agent stops normal flow and escalates. | Shows guardrails and prevents “AI does everything” criticism. |

## 12. Claims Officer Experience

The human experience should be designed around decision quality, not around displaying every token the AI generated. The claims officer needs a concise operational picture with the ability to inspect supporting evidence.

| Panel | Content |
|---|---|
| Claim header | Claim ID, customer, policy, status, route. |
| Incident | Structured timeline and customer-stated facts. |
| Coverage | Relevant policy fields, checks passed/failed, source reference. |
| Evidence | Photos/documents with AI observations and confidence. |
| Assessment | Preliminary damage range, assumptions, missing information. |
| Risk & uncertainty | Flags, conflicts, and reasons for escalation. |
| Recommended action | Suggested next step, explicitly non-binding. |
| Actions | Approve next stage, request information, escalate, edit/override. |
| Audit | Tool actions and key state changes. |

## 13. UX and Conversation Design

Natural, calm, empathetic voice. The customer has just experienced an accident.

Minimum necessary questions. Avoid making the conversation feel like a form read aloud.

Progressive disclosure. Ask for more detail only when the claim state requires it.

Transparent transitions. Tell the customer when the system is checking a policy or analysing an upload.

Never overclaim. Use phrases such as “Based on your policy record...” and “preliminary estimate.”

Fast escalation. When a claim needs human judgment, the agent should make the handoff feel intentional rather than like a failure.

## 14. 48-Hour Build Strategy

| Time | Goal | Deliverables |
|---|---|---|
| 0–4h | Lock scope | Final user flow, architecture, demo scenarios, synthetic data schema. |
| 4–10h | Voice loop | ElevenLabs agent handles initial conversation and gathers structured state. |
| 10–18h | Business tools | Policy lookup, claim creation/update, triage and persistence. |
| 18–26h | Evidence | Upload flow, multimodal analysis, preliminary assessment. |
| 26–34h | Human experience | Claims officer dashboard and readable case summary. |
| 34–40h | Integration | Connect the full workflow and add audit/uncertainty states. |
| 40–44h | Polish | Conversation tuning, loading states, seeded demo data, error handling. |
| 44–48h | Presentation | Demo rehearsal, judge Q&A, screenshots/video fallback, final deployment. |

### 14.1 Build priority

Priority order: voice → tool execution → persisted claim state → evidence → dashboard → polish. Do not spend the first day building a beautiful dashboard before the agent can complete the core workflow.

## 15. Team Structure

| Role | Primary ownership | Secondary ownership |
|---|---|---|
| Agent / AI engineer | ElevenLabs, prompts, tool calling, orchestration, conversation state. | Guardrails and evaluation. |
| Backend engineer | APIs, database, synthetic data, claim state, audit events. | Deployment/integration. |
| Frontend/product engineer | Claims officer dashboard, evidence UX, visual state. | Demo polish. |
| Product/UX/pitch lead | Workflow design, conversation scripts, judging narrative, demo. | User testing and documentation. |
| Full-stack / floater | Integration gaps, testing, edge cases. | Pitch backup. |

For a 2–3 person team, combine roles aggressively and keep the UI minimal. The agent + backend loop is the critical path.

## 16. Success Metrics

| Metric | Prototype target | What it demonstrates |
|---|---|---|
| First-contact completion | Most demo claims reach a structured claim record in one interaction. | End-to-end capability. |
| Information completeness | Required fields are populated or explicitly marked missing. | Less back-and-forth. |
| Evidence processing | Uploaded evidence appears in the claim with structured findings. | Multimodal capability. |
| Human handoff quality | Claims officer can understand the case without replaying the entire conversation. | Operational usefulness. |
| Guardrail accuracy | High-risk scenario is escalated reliably in test scenarios. | Safe autonomy. |
| Demo reliability | Core flow succeeds repeatedly on seeded data. | Hackathon execution quality. |

## 17. Competitive Positioning

The proposal should acknowledge the category rather than pretending it does not exist. The differentiation is the end-to-end operating model: voice intake is the entry point, but the product value is the conversion of conversation and evidence into an actionable claims workflow with bounded autonomy and a high-quality human handoff.

| Common alternative | Weakness relative to proposal | Our positioning |
|---|---|---|
| Traditional call centre | High labour cost and repetitive intake. | Move routine intake and preparation to an agent. |
| Web forms | Rigid, slow, poor fit for stressful incidents. | Natural voice + adaptive questioning. |
| Generic voice bot | Can answer or collect fields but may stop short of real work. | Tool execution changes claim state. |
| AI FNOL-only product | Focuses primarily on first notice capture. | Continue into evidence, assessment, triage, and decision-ready handoff. |
| Human-only workflow | Strong judgment but costly and variable for repetitive tasks. | Reserve human time for exceptions and decisions. |

## 18. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Hallucinated policy coverage | High | Ground coverage answers in retrieved mock policy fields and deterministic checks. |
| Over-trusting damage estimate | High | Label estimates as preliminary; surface assumptions; require human approval. |
| Voice latency | Medium | Keep prompts concise; precompute demo data; allow async evidence analysis with progress UI. |
| Scope creep | High | Freeze MVP after voice → claim creation → evidence → handoff works. |
| Demo internet/API failure | Medium | Prepare seeded fallback recordings and deterministic demo path. |
| Looks like a thin chatbot | High | Make tool calls, database state changes, evidence processing, and officer dashboard visible. |
| Too close to existing products | Medium | Position around claim orchestration and decision-ready handoff, not novelty of FNOL. |

## 19. Anticipated Judge Questions

| Question | Answer |
|---|---|
| “Isn’t this already being done?” | Voice FNOL is already a real category. Our prototype goes beyond intake by orchestrating evidence, policy checks, triage, and the human decision workflow. |
| “Why voice?” | After an accident, speaking naturally is often easier than completing a rigid form. Voice lets the customer describe the event while the agent creates structured data and takes actions. |
| “Why does this need an LLM?” | The customer narrative is unstructured and the next best question depends on what is missing. The model handles language and flexible interaction; deterministic rules constrain high-impact decisions. |
| “Will it replace adjusters?” | The design is intentionally human-in-the-loop. The goal is to remove repetitive intake and preparation so humans spend time on ambiguous, high-value decisions. |
| “How do you prevent hallucinations?” | Retrieved source data, explicit tools, deterministic coverage checks, uncertainty states, audit events, and human approval for consequential actions. |
| “What happens in production?” | Production would require insurer integrations, identity controls, security, regulatory review, model evaluation, monitoring, and governed automation thresholds. The hackathon prototype deliberately uses synthetic systems. |

## 20. The 3-Minute Demo Story

| Time | Screen / action | Narrative |
|---|---|---|
| 0:00–0:20 | Customer calls. | “I’ve just crashed my car. I don’t know what I need to do.” |
| 0:20–0:55 | ElevenLabs conversation. | Agent checks safety, captures incident, retrieves policy context, asks adaptive questions. |
| 0:55–1:20 | Evidence upload. | Customer uploads damage photos; system analyses them and updates the claim. |
| 1:20–1:45 | Live claim state. | Policy, coverage, evidence, estimate, and triage status appear as completed work. |
| 1:45–2:20 | Claims officer view. | Human sees a decision-ready case with supporting evidence and uncertainty. |
| 2:20–2:40 | Escalation demonstration. | Show a second scenario with injury or conflicting evidence routing to human review. |
| 2:40–3:00 | Closing slide. | “The voice is the interface. The real product is the agent that does the work.” |

Do not open the demo with a slide deck. Open with the accident. Make the judges experience the workflow before explaining the architecture.

## 21. Track Strategy

Primary: Track 2 — Create a New Business Capability

Track 2 is the strongest positioning because the prototype demonstrates an AI-native business capability: a system that can interact with a customer, inspect evidence, retrieve business context, execute actions across a claims workflow, and decide when a human should take over. The “new capability” is the agentic operating layer, not voice alone.

Secondary: Built With ElevenLabs

ElevenLabs is core to the product because voice is the primary customer interface. The customer does not need to translate their experience into insurance form fields; they speak naturally, and the agent performs the translation into business actions. This makes the voice technology integral to the workflow rather than a decorative feature.

Fallback: Track 1 or Track 3

The same prototype can be described under Track 1 as a significant improvement to claims intake/processing, or under Track 3 as a response to the business problem of claims delays and administrative burden. However, Track 2 gives the clearest strategic story if the prototype demonstrates genuine agentic execution.

## 22. Post-Hackathon Roadmap

| Phase | Capability |
|---|---|
| 0–3 months | More claim types, stronger policy retrieval, better auditability, configurable business rules, real insurer-style integrations. |
| 3–6 months | Repairer networks, document automation, richer triage, claim status across channels, multilingual support. |
| 6–12 months | Controlled autonomous pathways for eligible claims, production monitoring, model evaluation, security/compliance, carrier-specific workflows. |

The prototype should not claim production readiness. Its purpose is to demonstrate a credible direction and a technically coherent architecture.

## 23. Implementation Checklist

Freeze one motor-claim scenario as the golden path.

Create synthetic customer, policy, claim, and evidence data.

Build the ElevenLabs voice agent and confirm tool calling.

Implement policy lookup and claim creation before any UI polish.

Persist conversation-derived structured state.

Implement evidence upload and multimodal analysis.

Implement explicit triage and escalation rules.

Build a single-screen claims officer dashboard.

Add visible audit trail / action history.

Test ambiguous and injury scenarios.

Rehearse the three-minute demo repeatedly.

Prepare a fallback recorded voice demo in case network/API reliability fails.

Sanitize all demo data and remove real personal information.

## 24. Sources

[1] ElevenLabs — Insurance AI answering service and virtual receptionist. https://elevenlabs.io/ai-answering-service/insurance

[2] ElevenLabs — Conversational AI in insurance: claims intake and workflow automation. https://elevenlabs.io/blog/conversational-ai-in-insurance

[3] Guidewire — Qusar cloud release, including Agentic FNOL and claims capabilities (Aug 2026). https://www.guidewire.com/products/technology/guidewire-cloud-platform-releases

[4] Allianz Australia — 2026 Canstar Innovation Excellence Award for automation of food spoilage claims. https://www.allianz.com.au/about-us/work-with-us/partners/news/allianz-wins-2026-canstar-innovation-excellence-award.html

## Final recommendation

Build the insurance claims agent. Do not sell it as “an AI chatbot that files a claim.” Sell it as a new operating capability: a voice-first agent that moves a claim from messy human conversation to a structured, evidence-backed, human-ready decision package. That is the most defensible version of the idea within 48 hours.
