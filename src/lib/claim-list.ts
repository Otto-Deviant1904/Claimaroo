import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { claims, customers, policies } from "@/db/schema";
import { pretty, type ClaimView } from "@/lib/claim-view";

export type ClaimListItem = Pick<
  ClaimView,
  | "id"
  | "name"
  | "policyId"
  | "vehicle"
  | "rego"
  | "incident"
  | "date"
  | "location"
  | "status"
  | "route"
  | "riskFlags"
  | "updatedAt"
>;

function iso(value: Date | string | null | undefined) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function toClaimListItem(row: {
  id: string;
  status: ClaimListItem["status"];
  route: ClaimListItem["route"];
  incidentTime: string | null;
  location: string | null;
  updatedAt: Date | string | null;
  flags: string[] | null;
  structuredFacts: { incidentType?: string | null } | null;
  policyId: string;
  customerName: string;
  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  registration: string | null;
}): ClaimListItem {
  const vehicle = [row.vehicleYear, row.vehicleMake, row.vehicleModel]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    id: row.id,
    name: row.customerName,
    policyId: row.policyId,
    vehicle: vehicle || "Vehicle unknown",
    rego: row.registration || "",
    incident: row.structuredFacts?.incidentType
      ? pretty(String(row.structuredFacts.incidentType))
      : "Collision",
    date: row.incidentTime ? row.incidentTime.slice(0, 10) : null,
    location: row.location,
    status: row.status,
    route: row.route,
    riskFlags: row.flags ?? [],
    updatedAt: iso(row.updatedAt),
  };
}

export async function listInboxClaims(): Promise<ClaimListItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: claims.id,
      status: claims.status,
      route: claims.route,
      incidentTime: claims.incidentTime,
      location: claims.location,
      updatedAt: claims.updatedAt,
      flags: claims.flags,
      structuredFacts: claims.structuredFacts,
      policyId: claims.policyId,
      customerName: customers.name,
      vehicleYear: policies.vehicleYear,
      vehicleMake: policies.vehicleMake,
      vehicleModel: policies.vehicleModel,
      registration: policies.registration,
    })
    .from(claims)
    .innerJoin(customers, eq(customers.id, claims.customerId))
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .orderBy(desc(claims.updatedAt));
  return rows.map(toClaimListItem);
}
