import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  customType,
} from "drizzle-orm/pg-core";
import type {
  ClaimStatus,
  ConfidenceLevel,
  CoverageStatus,
  CoverageType,
  DamageFinding,
  PolicyRule,
  StructuredFacts,
  TranscriptEntry,
  TriageRoute,
} from "../lib/types";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
});

export const policies = pgTable("policies", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  vehicleMake: text("vehicle_make").notNull(),
  vehicleModel: text("vehicle_model").notNull(),
  vehicleYear: integer("vehicle_year").notNull(),
  registration: text("registration").notNull(),
  vehicleColour: text("vehicle_colour"),
  coverageType: text("coverage_type").$type<CoverageType>().notNull(),
  excessCents: integer("excess_cents").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status").notNull(),
  relevantRules: jsonb("relevant_rules").$type<PolicyRule[]>().notNull(),
});

export const claims = pgTable("claims", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  policyId: text("policy_id")
    .notNull()
    .references(() => policies.id),
  status: text("status").$type<ClaimStatus>().notNull(),
  incidentTime: text("incident_time"),
  location: text("location"),
  narrative: text("narrative"),
  structuredFacts: jsonb("structured_facts")
    .$type<StructuredFacts>()
    .notNull()
    .default({}),
  route: text("route").$type<TriageRoute>(),
  routeReason: text("route_reason"),
  confidence: text("confidence").$type<ConfidenceLevel>(),
  flags: jsonb("flags").$type<string[]>().notNull().default([]),
  coverageStatus: text("coverage_status").$type<CoverageStatus>(),
  coverageNotes: text("coverage_notes"),
  coverageRuleRefs: jsonb("coverage_rule_refs").$type<string[]>().default([]),
  recommendedAction: text("recommended_action"),
  summary: text("summary"),
  officerNotes: text("officer_notes"),
  conversationId: text("conversation_id"),
  transcript: jsonb("transcript")
    .$type<TranscriptEntry[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const evidence = pgTable("evidence", {
  id: text("id").primaryKey(),
  claimId: text("claim_id")
    .notNull()
    .references(() => claims.id),
  type: text("type").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileUrl: text("file_url").notNull(),
  bytes: bytea("bytes"),
  extractedFacts: jsonb("extracted_facts").$type<Record<string, unknown>>(),
  analysisConfidence: text("analysis_confidence").$type<ConfidenceLevel>(),
  analysisLimitations: text("analysis_limitations"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const assessments = pgTable("assessments", {
  claimId: text("claim_id")
    .primaryKey()
    .references(() => claims.id),
  damageFindings: jsonb("damage_findings")
    .$type<DamageFinding[]>()
    .notNull()
    .default([]),
  estimateLowCents: integer("estimate_low_cents"),
  estimateHighCents: integer("estimate_high_cents"),
  assumptions: jsonb("assumptions").$type<string[]>().notNull().default([]),
  label: text("label").notNull().default("preliminary"),
  missingInformation: jsonb("missing_information")
    .$type<string[]>()
    .notNull()
    .default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  claimId: text("claim_id"),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .defaultNow()
    .notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  tool: text("tool"),
  inputsSummary: text("inputs_summary"),
  resultSummary: text("result_summary"),
});
