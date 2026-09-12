import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId =
    process.env.ELEVENLABS_AGENT_ID ||
    process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

  if (!apiKey || !agentId) {
    return NextResponse.json(
      {
        error:
          "Voice is not configured. Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID. Schema, tools, and the officer dashboard still work.",
        missing: {
          apiKey: !apiKey,
          agentId: !agentId,
        },
      },
      { status: 503 },
    );
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": apiKey } },
  );

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: "Failed to get signed URL", detail },
      { status: 502 },
    );
  }

  const data = (await response.json()) as { signed_url?: string };
  return NextResponse.json({ signedUrl: data.signed_url });
}
