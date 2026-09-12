import { NextResponse } from "next/server";

// Permissive CORS for the prototype APIs. The officer workspace is now
// same-origin at /claims; this remains for local tooling and curl demos.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export function withCors<T>(res: NextResponse<T>): NextResponse<T> {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: { ...CORS_HEADERS } });
}
