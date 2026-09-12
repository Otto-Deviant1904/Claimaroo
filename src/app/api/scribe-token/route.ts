import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  const elevenlabs = new ElevenLabsClient({ apiKey });
  const { token } = await elevenlabs.tokens.singleUse.create("realtime_scribe");

  return NextResponse.json({ token });
}
