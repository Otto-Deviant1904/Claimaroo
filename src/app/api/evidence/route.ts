import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims, evidence } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { newId } from "@/lib/format";

export async function POST(request: Request) {
  const form = await request.formData();
  const claimId = String(form.get("claimId") ?? "");
  const file = form.get("file");
  if (!claimId) {
    return NextResponse.json({ error: "claimId is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const db = getDb();
  const [claim] = await db.select().from(claims).where(eq(claims.id, claimId));
  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const id = newId("EVD");
  const mime = file.type || "application/octet-stream";
  const type = mime.startsWith("image/") ? "photo" : "document";

  await db.insert(evidence).values({
    id,
    claimId,
    type,
    filename: file.name,
    mimeType: mime,
    fileUrl: `/api/evidence/${id}/file`,
    bytes,
  });

  await db
    .update(claims)
    .set({
      status: claim.status === "intake" ? "awaiting_evidence" : claim.status,
      updatedAt: new Date(),
    })
    .where(eq(claims.id, claimId));

  await recordAudit({
    claimId,
    actor: "customer",
    action: "tool:attach_evidence",
    tool: "attach_evidence",
    inputs: { filename: file.name, mime, bytes: file.size },
    result: { evidenceId: id },
  });

  return NextResponse.json({
    evidenceId: id,
    claimId,
    filename: file.name,
    fileUrl: `/api/evidence/${id}/file`,
  });
}
