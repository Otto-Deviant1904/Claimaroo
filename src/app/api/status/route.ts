import { NextResponse } from "next/server";

export async function GET() {
  const elevenlabsKey = Boolean(process.env.ELEVENLABS_API_KEY);
  const agentId = Boolean(
    process.env.ELEVENLABS_AGENT_ID ||
      process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID,
  );
  const openai = Boolean(process.env.OPENAI_API_KEY);
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const database = Boolean(process.env.DATABASE_URL);

  return NextResponse.json({
    elevenlabs: elevenlabsKey && agentId,
    elevenlabsKey,
    agentId,
    llm: openai ? "openai" : anthropic ? "anthropic" : null,
    database,
  });
}
