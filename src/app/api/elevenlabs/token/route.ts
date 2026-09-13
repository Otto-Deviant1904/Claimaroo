import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type UpstreamToken = {
  token?: string;
  conversation_token?: string;
};

export async function GET() {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!agentId) {
    return NextResponse.json(
      {
        error:
          "Voice is not configured. Set ELEVENLABS_AGENT_ID. The officer workspace still works.",
      },
      { status: 500 },
    );
  }

  if (process.env.ELEVENLABS_AGENT_PUBLIC === "true") {
    return NextResponse.json({ agentId });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "This agent requires authentication. Set ELEVENLABS_API_KEY, or set ELEVENLABS_AGENT_PUBLIC=true for a public agent.",
      },
      { status: 500 },
    );
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": apiKey } },
  );

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: `Failed to mint a conversation token. ${detail}` },
      { status: 502 },
    );
  }

  const data = (await response.json()) as UpstreamToken;
  const conversationToken = data.conversation_token ?? data.token;
  if (!conversationToken) {
    return NextResponse.json(
      { error: "ElevenLabs did not return a conversation token." },
      { status: 502 },
    );
  }

  return NextResponse.json({ conversationToken });
}
