import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getDb, getSql } from "./index";
import {
  assessments,
  auditEvents,
  claims,
  customers,
  evidence,
  policies,
} from "./schema";
import { demoPolicyTerm } from "../lib/demo";
import type { PolicyRule } from "../lib/types";

config({ path: ".env.local" });
config({ path: ".env" });

function rules(...texts: string[]): PolicyRule[] {
  return texts.map((text, i) => ({ id: `R${i + 1}`, text }));
}

function svg(title: string, subtitle: string, bg: string): Buffer {
  const markup = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
  <rect width="100%" height="100%" fill="${bg}"/>
  <rect x="32" y="32" width="896" height="476" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.35"/>
  <text x="60" y="220" fill="#ffffff" font-size="36" font-family="Georgia, serif">${escapeXml(title)}</text>
  <text x="60" y="270" fill="#f3f4f6" font-size="20" font-family="system-ui, sans-serif">${escapeXml(subtitle)}</text>
  <text x="60" y="470" fill="#e5e7eb" font-size="14" font-family="system-ui, sans-serif">Synthetic evidence — not a real photograph</text>
</svg>`;
  return Buffer.from(markup);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const PEOPLE = [
  {
    id: "CUST-MAYA",
    name: "Maya Chen",
    email: "maya.chen@example.test",
    phone: "0412000001",
    address: "18 Riley Street, Surry Hills NSW 2010",
    policy: {
      id: "POL-1001",
      vehicleMake: "Toyota",
      vehicleModel: "Corolla",
      vehicleYear: 2022,
      registration: "NSW-MAYA",
      vehicleColour: "silver",
      coverageType: "comprehensive" as const,
      excessCents: 80000,
      ...demoPolicyTerm(),
      status: "active",
      relevantRules: rules(
        "Comprehensive cover includes accidental collision damage to the insured vehicle, subject to excess.",
        "Windscreen claims may be treated separately from body damage.",
      ),
    },
  },
  {
    id: "CUST-LIAM",
    name: "Liam O'Brien",
    email: "liam.obrien@example.test",
    phone: "0412000002",
    address: "4 Greville Street, Prahran VIC 3181",
    policy: {
      id: "POL-1002",
      vehicleMake: "Mazda",
      vehicleModel: "3",
      vehicleYear: 2019,
      registration: "VIC-LIAM",
      vehicleColour: "blue",
      coverageType: "comprehensive" as const,
      excessCents: 100000,
      startDate: "2025-11-01",
      endDate: "2026-10-31",
      status: "active",
      relevantRules: rules(
        "Liability disputes require human assessment even when comprehensive cover is in force.",
      ),
    },
  },
  {
    id: "CUST-PRIYA",
    name: "Priya Nair",
    email: "priya.nair@example.test",
    phone: "0412000003",
    address: "90 Boundary Street, West End QLD 4101",
    policy: {
      id: "POL-1003",
      vehicleMake: "Hyundai",
      vehicleModel: "i30",
      vehicleYear: 2021,
      registration: "QLD-PRIYA",
      vehicleColour: "white",
      coverageType: "comprehensive" as const,
      excessCents: 75000,
      startDate: "2026-01-15",
      endDate: "2027-01-14",
      status: "active",
      relevantRules: rules(
        "Injury or medical events override automated assessment and must be escalated.",
      ),
    },
  },
  {
    id: "CUST-JORDAN",
    name: "Jordan Walsh",
    email: "jordan.walsh@example.test",
    phone: "0412000004",
    address: "12 North Terrace, Adelaide SA 5000",
    policy: {
      id: "POL-1004",
      vehicleMake: "Ford",
      vehicleModel: "Ranger",
      vehicleYear: 2023,
      registration: "SA-JORD",
      vehicleColour: "grey",
      coverageType: "comprehensive" as const,
      excessCents: 120000,
      ...demoPolicyTerm(),
      status: "active",
      relevantRules: rules("Commercial accessories may be excluded unless listed."),
    },
  },
  {
    id: "CUST-SOPHIE",
    name: "Sophie Nguyen",
    email: "sophie.nguyen@example.test",
    phone: "0412000005",
    address: "6 Hay Street, Subiaco WA 6008",
    policy: {
      id: "POL-1005",
      vehicleMake: "Honda",
      vehicleModel: "Civic",
      vehicleYear: 2018,
      registration: "WA-SOPH",
      vehicleColour: "red",
      coverageType: "third_party" as const,
      excessCents: 0,
      startDate: "2026-03-01",
      endDate: "2027-02-28",
      status: "active",
      relevantRules: rules(
        "Third-party property only — own vehicle collision damage is not covered.",
      ),
    },
  },
  {
    id: "CUST-MARCUS",
    name: "Marcus Adeyemi",
    email: "marcus.adeyemi@example.test",
    phone: "0412000006",
    address: "21 London Circuit, Canberra ACT 2601",
    policy: {
      id: "POL-1006",
      vehicleMake: "Tesla",
      vehicleModel: "Model 3",
      vehicleYear: 2024,
      registration: "ACT-MARC",
      vehicleColour: "black",
      coverageType: "comprehensive" as const,
      excessCents: 150000,
      startDate: "2026-02-01",
      endDate: "2027-01-31",
      status: "active",
      relevantRules: rules("Battery and ADAS calibration may affect repair method."),
    },
  },
  {
    id: "CUST-ELENA",
    name: "Elena Papadopoulos",
    email: "elena.p@example.test",
    phone: "0412000007",
    address: "8 Salamanca Place, Hobart TAS 7000",
    policy: {
      id: "POL-1007",
      vehicleMake: "Volkswagen",
      vehicleModel: "Golf",
      vehicleYear: 2020,
      registration: "TAS-ELEN",
      vehicleColour: "white",
      coverageType: "third_party_fire_theft" as const,
      excessCents: 50000,
      startDate: "2025-08-01",
      endDate: "2026-07-31",
      status: "active",
      relevantRules: rules(
        "Fire and theft covered; accidental collision to the insured car is not.",
      ),
    },
  },
  {
    id: "CUST-WEI",
    name: "Chen Wei",
    email: "chen.wei@example.test",
    phone: "0412000008",
    address: "44 Hunter Street, Newcastle NSW 2300",
    policy: {
      id: "POL-1008",
      vehicleMake: "Subaru",
      vehicleModel: "Outback",
      vehicleYear: 2022,
      registration: "NSW-WEI",
      vehicleColour: "green",
      coverageType: "comprehensive" as const,
      excessCents: 90000,
      startDate: "2025-12-01",
      endDate: "2026-11-30",
      status: "active",
      relevantRules: rules("Windscreen excess may differ from standard excess."),
    },
  },
  {
    id: "CUST-AMELIA",
    name: "Amelia Brooks",
    email: "amelia.brooks@example.test",
    phone: "0412000009",
    address: "15 Flinders Street, Townsville QLD 4810",
    policy: {
      id: "POL-1009",
      vehicleMake: "Kia",
      vehicleModel: "Cerato",
      vehicleYear: 2017,
      registration: "QLD-AMEL",
      vehicleColour: "blue",
      coverageType: "third_party" as const,
      excessCents: 0,
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      status: "active",
      relevantRules: rules("Third-party property damage only."),
    },
  },
  {
    id: "CUST-NOAH",
    name: "Noah Singh",
    email: "noah.singh@example.test",
    phone: "0412000010",
    address: "3 Collins Street, Melbourne VIC 3000",
    policy: {
      id: "POL-1010",
      vehicleMake: "BMW",
      vehicleModel: "3 Series",
      vehicleYear: 2021,
      registration: "VIC-NOAH",
      vehicleColour: "black",
      coverageType: "comprehensive" as const,
      excessCents: 125000,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      relevantRules: rules("Manufacturer parts may be required for ADAS components."),
    },
  },
  {
    id: "CUST-HARPER",
    name: "Harper Diaz",
    email: "harper.diaz@example.test",
    phone: "0412000011",
    address: "70 George Street, Brisbane QLD 4000",
    policy: {
      id: "POL-1011",
      vehicleMake: "Toyota",
      vehicleModel: "Hilux",
      vehicleYear: 2019,
      registration: "QLD-HARP",
      vehicleColour: "white",
      coverageType: "comprehensive" as const,
      excessCents: 110000,
      startDate: "2025-06-01",
      endDate: "2026-05-31",
      status: "active",
      relevantRules: rules("Tray and aftermarket canopies must be listed to be covered."),
    },
  },
  {
    id: "CUST-OLIVER",
    name: "Oliver Grant",
    email: "oliver.grant@example.test",
    phone: "0412000012",
    address: "9 Murray Street, Perth WA 6000",
    policy: {
      id: "POL-1012",
      vehicleMake: "Holden",
      vehicleModel: "Commodore",
      vehicleYear: 2016,
      registration: "WA-OLIV",
      vehicleColour: "grey",
      coverageType: "comprehensive" as const,
      excessCents: 85000,
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      status: "expired",
      relevantRules: rules("Expired policies cannot be used for new incidents."),
    },
  },
  {
    id: "CUST-AVA",
    name: "Ava Rahman",
    email: "ava.rahman@example.test",
    phone: "0412000013",
    address: "2 Macquarie Street, Sydney NSW 2000",
    policy: {
      id: "POL-1013",
      vehicleMake: "Mercedes-Benz",
      vehicleModel: "A-Class",
      vehicleYear: 2023,
      registration: "NSW-AVA",
      vehicleColour: "white",
      coverageType: "comprehensive" as const,
      excessCents: 140000,
      startDate: "2025-10-01",
      endDate: "2026-09-30",
      status: "active",
      relevantRules: rules("Luxury vehicle excess applies as recorded on the schedule."),
    },
  },
  {
    id: "CUST-BEN",
    name: "Ben Okonkwo",
    email: "ben.okonkwo@example.test",
    phone: "0412000014",
    address: "55 King William Street, Adelaide SA 5000",
    policy: {
      id: "POL-1014",
      vehicleMake: "Nissan",
      vehicleModel: "X-Trail",
      vehicleYear: 2020,
      registration: "SA-BEN",
      vehicleColour: "silver",
      coverageType: "comprehensive" as const,
      excessCents: 95000,
      startDate: "2026-05-01",
      endDate: "2027-04-30",
      status: "active",
      relevantRules: rules("Family policy — listed drivers only."),
    },
  },
  {
    id: "CUST-ISLA",
    name: "Isla McKenzie",
    email: "isla.mckenzie@example.test",
    phone: "0412000015",
    address: "18 Cashel Street, Christchurch-style precinct, Melbourne VIC 3000",
    policy: {
      id: "POL-1015",
      vehicleMake: "MG",
      vehicleModel: "ZS",
      vehicleYear: 2022,
      registration: "VIC-ISLA",
      vehicleColour: "orange",
      coverageType: "third_party" as const,
      excessCents: 0,
      startDate: "2026-02-14",
      endDate: "2027-02-13",
      status: "active",
      relevantRules: rules("Third-party property damage only."),
    },
  },
];

export async function seed() {
  const db = getDb();
  if (process.env.SEED_RESET !== "1") {
    const already = await db
      .select({ id: customers.id })
      .from(customers)
      .limit(1);
    if (already.length > 0) {
      const term = demoPolicyTerm();
      const today = new Date().toISOString().slice(0, 10);
      const [maya] = await db
        .select({
          startDate: policies.startDate,
          endDate: policies.endDate,
        })
        .from(policies)
        .where(eq(policies.id, "POL-1001"));
      if (maya && (today < maya.startDate || today > maya.endDate)) {
        await db
          .update(policies)
          .set({ startDate: term.startDate, endDate: term.endDate })
          .where(eq(policies.id, "POL-1001"));
        console.log(
          `Refreshed POL-1001 term to ${term.startDate} – ${term.endDate}.`,
        );
      }
      console.log(
        "Seed skipped: customers already present. Set SEED_RESET=1 to replace.",
      );
      return;
    }
  }
  await db.delete(auditEvents);
  await db.delete(assessments);
  await db.delete(evidence);
  await db.delete(claims);
  await db.delete(policies);
  await db.delete(customers);

  for (const person of PEOPLE) {
    await db.insert(customers).values({
      id: person.id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      address: person.address,
    });
    await db.insert(policies).values({
      customerId: person.id,
      ...person.policy,
    });
  }

  const now = new Date();

  await db.insert(claims).values({
    id: "CLM-DEMO-A",
    customerId: "CUST-MAYA",
    policyId: "POL-1001",
    status: "decision_ready",
    incidentTime: "2026-09-10T08:42:00+10:00",
    location: "George Street & Park Street, Sydney NSW",
    narrative:
      "Stationary at the lights on George Street when a sedan rear-ended the Corolla. No injuries. Other driver exchanged details. Police not required.",
    structuredFacts: {
      injuries: false,
      emergencyServices: false,
      immediateDanger: false,
      otherVehicles: 1,
      otherPartyDetails: "Blue Hyundai, plate NSW-OTH1, driver exchanged details",
      atFaultStatement: "Other driver struck my stationary vehicle from behind",
      conflictingAccounts: false,
      weather: "clear",
      policeNotified: false,
      passengers: 0,
      vehicleDrivable: true,
      incidentType: "collision",
    },
    route: "auto_path",
    routeReason:
      "No safety flags, no conflicts, preliminary comprehensive coverage match, and required intake plus evidence are present.",
    confidence: "medium",
    flags: [],
    coverageStatus: "likely_covered",
    coverageNotes:
      "Preliminary only — not a binding insurance decision. Incident date falls within the recorded policy period. Comprehensive cover on the source record is consistent with a collision to the insured vehicle, subject to excess and exclusions.",
    coverageRuleRefs: ["POL-TERM", "COV-COMPREHENSIVE"],
    recommendedAction:
      "Suggested next stage: officer confirmation of the prepared case. Not a settlement or payment decision.",
    summary:
      "Straightforward rear-end. Maya Chen, POL-1001 comprehensive. Photos of rear bumper. Preliminary coverage likely. Suggested repair band recorded. Ready for officer confirmation.",
    createdAt: now,
    updatedAt: now,
  });

  const rear = svg(
    "Rear bumper — dented",
    "Synthetic still: silver Corolla rear bar, passenger-side dent",
    "#334155",
  );
  const scrape = svg(
    "Rear bumper — scrape",
    "Synthetic still: paint transfer across the bumper cover",
    "#1e3a5f",
  );

  await db.insert(evidence).values([
    {
      id: "EVD-A-1",
      claimId: "CLM-DEMO-A",
      type: "photo",
      filename: "maya-rear-bumper-dent.svg",
      mimeType: "image/svg+xml",
      fileUrl: "/api/evidence/EVD-A-1/file",
      bytes: rear,
      extractedFacts: {
        observations: ["Rear bumper deformation on the passenger side."],
        findings: [
          {
            area: "rear bumper",
            observation: "Rear bumper dent visible on labelled synthetic photo.",
            severity: "moderate",
            source: "heuristic",
          },
        ],
      },
      analysisConfidence: "medium",
      analysisLimitations:
        "Seeded analysis of a labelled synthetic image, not a real photograph.",
    },
    {
      id: "EVD-A-2",
      claimId: "CLM-DEMO-A",
      type: "photo",
      filename: "maya-rear-bumper-scrape.svg",
      mimeType: "image/svg+xml",
      fileUrl: "/api/evidence/EVD-A-2/file",
      bytes: scrape,
      extractedFacts: {
        observations: ["Paint transfer across the rear bumper cover."],
        findings: [
          {
            area: "paintwork",
            observation: "Scrape / paint transfer on rear bumper.",
            severity: "minor",
            source: "heuristic",
          },
        ],
      },
      analysisConfidence: "medium",
      analysisLimitations:
        "Seeded analysis of a labelled synthetic image, not a real photograph.",
    },
  ]);

  await db.insert(assessments).values({
    claimId: "CLM-DEMO-A",
    damageFindings: [
      {
        area: "rear bumper",
        observation: "Rear bumper dent visible on labelled synthetic photo.",
        severity: "moderate",
        source: "heuristic",
      },
      {
        area: "paintwork",
        observation: "Scrape / paint transfer on rear bumper.",
        severity: "minor",
        source: "heuristic",
      },
    ],
    estimateLowCents: 250000,
    estimateHighCents: 650000,
    assumptions: [
      "Labour and parts are modelled from a simple severity band, not a repairer quote.",
      "Does not include hire car, towing, betterment, or total-loss assessment.",
    ],
    label: "preliminary",
    missingInformation: [],
  });

  await db.insert(claims).values({
    id: "CLM-DEMO-B",
    customerId: "CUST-LIAM",
    policyId: "POL-1002",
    status: "human_review",
    incidentTime: "2026-09-09T18:10:00+10:00",
    location: "Chapel Street, South Yarra VIC",
    narrative:
      "Customer first said the other car changed lanes into him, then said he might have clipped their mirror while merging. Details of the other vehicle keep changing.",
    structuredFacts: {
      injuries: false,
      emergencyServices: false,
      immediateDanger: false,
      otherVehicles: 1,
      otherPartyDetails: "Unclear — described as both a white SUV and a dark sedan",
      atFaultStatement: "Conflicting: other driver / possibly me while merging",
      conflictingAccounts: true,
      conflictNotes:
        "Lane-change vs merge contact. Other vehicle description is inconsistent.",
      weather: "dusk",
      policeNotified: false,
      passengers: 1,
      vehicleDrivable: true,
      incidentType: "collision",
    },
    route: "human_review",
    routeReason:
      "Customer account contains conflicting facts. The case is routed for human judgment rather than resolved by the agent.",
    confidence: "low",
    flags: ["conflicting_accounts"],
    coverageStatus: "likely_covered",
    coverageNotes:
      "Preliminary comprehensive match only. Liability is not determined by this check.",
    coverageRuleRefs: ["POL-TERM", "COV-COMPREHENSIVE"],
    recommendedAction:
      "Claims officer should inspect the conflict, evidence, and policy record before any next step.",
    summary:
      "Ambiguous liability. Liam O'Brien gave conflicting accounts. Do not auto-progress. Human review.",
    createdAt: now,
    updatedAt: now,
  });

  const side = svg(
    "Side panel — unclear contact",
    "Synthetic still: mirror and door scuff, impact direction uncertain",
    "#57534e",
  );
  await db.insert(evidence).values({
    id: "EVD-B-1",
    claimId: "CLM-DEMO-B",
    type: "photo",
    filename: "liam-side-scuff.svg",
    mimeType: "image/svg+xml",
    fileUrl: "/api/evidence/EVD-B-1/file",
    bytes: side,
    extractedFacts: {
      observations: ["Side scuff; direction of force is not obvious from the still."],
    },
    analysisConfidence: "low",
    analysisLimitations:
      "Image does not resolve which vehicle moved into the other. Uncertainty preserved.",
  });
  await db.insert(assessments).values({
    claimId: "CLM-DEMO-B",
    damageFindings: [
      {
        area: "side panel",
        observation: "Scuff to mirror/door. Impact direction uncertain.",
        severity: "minor",
        source: "heuristic",
      },
    ],
    estimateLowCents: 80000,
    estimateHighCents: 180000,
    assumptions: [
      "Range ignores liability. Repair cost is not a coverage decision.",
    ],
    label: "preliminary",
    missingInformation: [
      "Consistent other-party details",
      "Dashcam or independent witness",
    ],
  });

  await db.insert(claims).values({
    id: "CLM-DEMO-C",
    customerId: "CUST-PRIYA",
    policyId: "POL-1003",
    status: "urgent",
    incidentTime: "2026-09-11T07:05:00+10:00",
    location: "Pacific Motorway, near Eight Mile Plains QLD",
    narrative:
      "High-speed rear impact. Customer reported neck pain and said an ambulance was on the way. Agent stopped ordinary claim processing.",
    structuredFacts: {
      injuries: true,
      injuryDescription: "Neck pain; ambulance requested",
      emergencyServices: true,
      immediateDanger: false,
      otherVehicles: 1,
      atFaultStatement: "Not collected — safety override",
      conflictingAccounts: false,
      policeNotified: true,
      passengers: 0,
      vehicleDrivable: false,
      incidentType: "collision",
    },
    route: "urgent",
    routeReason:
      "Injury reported. Safety override — urgent human handling.",
    confidence: "high",
    flags: ["injury_reported", "emergency_services"],
    coverageStatus: "likely_covered",
    coverageNotes:
      "Preliminary comprehensive match. Injury handling is with a human. Not a medical or liability determination.",
    coverageRuleRefs: ["POL-TERM", "COV-COMPREHENSIVE", "COV-INJURY-REVIEW"],
    recommendedAction:
      "Urgent human contact. Do not continue automated assessment. Confirm safety and emergency services.",
    summary:
      "Injury / urgent. Priya Nair. Stop automated assessment. Officer to take over.",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(auditEvents).values([
    {
      id: "AUD-A-1",
      claimId: "CLM-DEMO-A",
      actor: "agent",
      action: "tool:create_claim",
      tool: "create_claim",
      inputsSummary: "Maya Chen / POL-1001 rear-end George Street",
      resultSummary: "CLM-DEMO-A created",
    },
    {
      id: "AUD-A-2",
      claimId: "CLM-DEMO-A",
      actor: "agent",
      action: "tool:run_coverage_check",
      tool: "run_coverage_check",
      inputsSummary: "CLM-DEMO-A",
      resultSummary: "preliminary likely_covered",
    },
    {
      id: "AUD-A-3",
      claimId: "CLM-DEMO-A",
      actor: "agent",
      action: "tool:run_triage",
      tool: "run_triage",
      inputsSummary: "CLM-DEMO-A",
      resultSummary: "auto_path",
    },
    {
      id: "AUD-B-1",
      claimId: "CLM-DEMO-B",
      actor: "agent",
      action: "tool:run_triage",
      tool: "run_triage",
      inputsSummary: "CLM-DEMO-B",
      resultSummary: "human_review — conflicting_accounts",
    },
    {
      id: "AUD-C-1",
      claimId: "CLM-DEMO-C",
      actor: "agent",
      action: "tool:escalate_claim",
      tool: "escalate_claim",
      inputsSummary: "injury, ambulance",
      resultSummary: "urgent queue",
    },
  ]);

  console.log(
    `Seeded ${PEOPLE.length} customers, 3 demo claims (CLM-DEMO-A/B/C).`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(async () => {
      await getSql().end({ timeout: 5 });
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      try {
        await getSql().end({ timeout: 5 });
      } catch {
        // ignore
      }
      process.exit(1);
    });
}
