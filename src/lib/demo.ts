export const DEMO_SCENARIOS = [
  {
    id: "A",
    claimId: "CLM-DEMO-A",
    title: "Straightforward rear-end",
    customer: "Maya Chen",
    customerId: "CUST-MAYA",
    policyId: "POL-1001",
    phone: "0412 000 001",
    spoken:
      "Hi, I was just rear-ended at the lights on George Street in Sydney. I'm Maya Chen. Nobody's hurt. My number is 0412 000 001. I was stationary. The other driver hit my Toyota Corolla from behind.",
    why: "Happy path: comprehensive cover, complete photos, auto pathway.",
  },
  {
    id: "B",
    claimId: "CLM-DEMO-B",
    title: "Ambiguous / conflict",
    customer: "Liam O'Brien",
    customerId: "CUST-LIAM",
    policyId: "POL-1002",
    phone: "0412 000 002",
    spoken:
      "It's Liam O'Brien, 0412 000 002. I think the other car changed lanes into me on Chapel Street... actually wait, I might have clipped their mirror when I merged. It was a white SUV. Or maybe a dark sedan. I'm not sure who hit who.",
    why: "Conflict is preserved and routed to human review.",
  },
  {
    id: "C",
    claimId: "CLM-DEMO-C",
    title: "Injury / urgent",
    customer: "Priya Nair",
    customerId: "CUST-PRIYA",
    policyId: "POL-1003",
    phone: "0412 000 003",
    spoken:
      "This is Priya Nair, 0412 000 003. Someone smashed into me on the Pacific Motorway. My neck hurts and the ambulance is on the way.",
    why: "Safety override. Ordinary assessment stops.",
  },
] as const;

export const TOOL_PARAM_SCHEMA = {
  get_customer: {
    description:
      "Look up a synthetic customer by customer_id, phone, email, or name. Returns the source profile and policy ids. Never invent a customer.",
    properties: {
      customer_id: { type: "string", description: "e.g. CUST-MAYA" },
      phone: { type: "string", description: "Mobile number" },
      email: { type: "string" },
      name: { type: "string", description: "Full name" },
    },
  },
  get_policy: {
    description:
      "Retrieve a mock policy from the source record: vehicle, coverage type, excess, term, status, rules.",
    properties: {
      policy_id: { type: "string", description: "e.g. POL-1001" },
      customer_id: { type: "string" },
      registration: { type: "string" },
    },
  },
  create_claim: {
    description:
      "Persist a new claim. Requires customer_id and policy_id from prior lookups.",
    properties: {
      customer_id: { type: "string" },
      policy_id: { type: "string" },
      incident_time: { type: "string" },
      location: { type: "string" },
      narrative: { type: "string" },
      structured_facts: { type: "object" },
      conversation_id: { type: "string" },
    },
  },
  update_claim: {
    description: "Merge structured fields onto an existing claim.",
    properties: {
      claim_id: { type: "string" },
      incident_time: { type: "string" },
      location: { type: "string" },
      narrative: { type: "string" },
      structured_facts: { type: "object" },
    },
  },
  attach_evidence: {
    description:
      "Attach an already-uploaded evidence file to a claim using evidence_id from the upload panel.",
    properties: {
      claim_id: { type: "string" },
      evidence_id: { type: "string" },
    },
  },
  analyse_damage: {
    description:
      "Analyse attached evidence. Returns observations, confidence, and limitations. Preliminary only.",
    properties: {
      claim_id: { type: "string" },
      evidence_ids: { type: "array", items: { type: "string" } },
    },
  },
  run_coverage_check: {
    description:
      "Deterministic preliminary coverage check against the source policy. Never a binding decision.",
    properties: {
      claim_id: { type: "string" },
    },
  },
  run_triage: {
    description:
      "Apply explicit routing rules: auto_path, human_review, or urgent.",
    properties: {
      claim_id: { type: "string" },
    },
  },
  estimate_repair: {
    description:
      "Suggested / preliminary repair range from damage findings. Not a quote.",
    properties: {
      claim_id: { type: "string" },
    },
  },
  escalate_claim: {
    description:
      "Place the claim on a human queue. Set urgent=true for injury or danger.",
    properties: {
      claim_id: { type: "string" },
      reason: { type: "string" },
      urgent: { type: "boolean" },
    },
  },
  generate_summary: {
    description:
      "Write a decision-ready summary onto the claim for the officer dashboard.",
    properties: {
      claim_id: { type: "string" },
    },
  },
} as const;
