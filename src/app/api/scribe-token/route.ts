import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Voice is not configured. Set ELEVENLABS_API_KEY. Schema, tools, and the officer dashboard still work.",
        missing: { apiKey: true },
      },
      { status: 503 },
    );
  }

  try {
    const elevenlabs = new ElevenLabsClient({ apiKey });
    const { token } = await elevenlabs.tokens.singleUse.create("realtime_scribe");
    if (!token) {
      return NextResponse.json(
        { error: "Failed to create scribe token", detail: "Empty token" },
        { status: 502 },
      );
    }
    return NextResponse.json({ token });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create scribe token", detail },
      { status: 502 },
    );
  }
}
