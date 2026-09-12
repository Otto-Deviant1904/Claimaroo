import { NextResponse } from "next/server";
import { executeTool } from "@/lib/tools";
import { TOOL_NAMES } from "@/lib/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // ElevenLabs webhook envelope
  if (body.parameters && typeof body.parameters === "object") {
    body = {
      ...(body.parameters as Record<string, unknown>),
      conversation_id: body.conversation_id,
    };
  }

  try {
    const result = await executeTool(name, body, { actor: "agent" });
    return NextResponse.json({ ok: true, result, resultText: JSON.stringify(result) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ tools: TOOL_NAMES });
}
