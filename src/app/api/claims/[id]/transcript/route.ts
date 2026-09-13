import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { corsPreflight, withCors } from "@/lib/cors";
import type { TranscriptEntry, TranscriptRole } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROLES: TranscriptRole[] = ["agent", "user", "tool", "system"];
const MAX_ENTRIES = 400;
const MAX_TEXT = 2000;

function sanitize(raw: unknown): TranscriptEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const entries: TranscriptEntry[] = [];
  for (const item of raw.slice(-MAX_ENTRIES)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const role = record.role as TranscriptRole;
    const text = typeof record.text === "string" ? record.text : "";
    if (!ROLES.includes(role) || !text.trim()) continue;
    entries.push({
      at: typeof record.at === "string" ? record.at : new Date().toISOString(),
      role,
      text: text.slice(0, MAX_TEXT),
      ...(typeof record.name === "string" && record.name
        ? { name: record.name.slice(0, 80) }
        : {}),
    });
  }
  return entries;
}

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withCors(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }));
  }

  const transcript = sanitize((body as { transcript?: unknown })?.transcript);
  if (!transcript) {
    return withCors(
      NextResponse.json({ error: "transcript array is required" }, { status: 400 }),
    );
  }

  const db = getDb();
  const [claim] = await db.select({ id: claims.id }).from(claims).where(eq(claims.id, id));
  if (!claim) {
    return withCors(NextResponse.json({ error: "Claim not found" }, { status: 404 }));
  }

  await db
    .update(claims)
    .set({ transcript, updatedAt: new Date() })
    .where(eq(claims.id, id));

  await recordAudit({
    claimId: id,
    actor: "agent",
    action: "transcript_saved",
    result: `${transcript.length} entries`,
  });

  return withCors(NextResponse.json({ ok: true, saved: transcript.length }));
}
