import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { evidence } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const db = getDb();
  const [row] = await db.select().from(evidence).where(eq(evidence.id, id));
  if (!row?.bytes) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Disposition": `inline; filename="${row.filename}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
