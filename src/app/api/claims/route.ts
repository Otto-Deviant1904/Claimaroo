import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims, customers } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: claims.id,
        status: claims.status,
        route: claims.route,
        location: claims.location,
        incidentTime: claims.incidentTime,
        updatedAt: claims.updatedAt,
        customerName: customers.name,
        policyId: claims.policyId,
        flags: claims.flags,
      })
      .from(claims)
      .innerJoin(customers, eq(customers.id, claims.customerId))
      .orderBy(desc(claims.updatedAt));
    return NextResponse.json({ claims: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database unavailable";
    return NextResponse.json({ error: message, claims: [] }, { status: 503 });
  }
}
