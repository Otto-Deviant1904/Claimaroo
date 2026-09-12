# Claimaroo customer pages

Landing (`/`) and customer intake (`/claim`) sit in the existing Next.js app. No extra install. `@elevenlabs/react` is already a dependency.

## CSS import

Do not add an import in `src/app/layout.tsx` or `src/app/globals.css`. Both pages import `src/app/claimaroo.css` themselves.

## Workspace path

Both pages declare `const WORKSPACE = "/claims"` at the top. Change that one line if the officer workspace moves.

## Environment

```
ELEVENLABS_AGENT_ID=agent_4301m2aeyrxterxa6h7vc2bnmx9e
ELEVENLABS_AGENT_PUBLIC=true
# ELEVENLABS_API_KEY=sk_...      # only once the agent requires auth
```

`/api/elevenlabs/token` returns `{ agentId }` when `ELEVENLABS_AGENT_PUBLIC=true`. Otherwise it mints a conversation token with the API key.

Permissive CORS on `/api/claims` and unauthenticated customer lookup are demo-only. They are not production security controls. Do not treat them as an auth system.

## Photos

The customer must add at least one photo before Start the call. Bytes stay in the browser until `create_claim` returns a real Postgres `claimId`. The page then POSTs each pending file to `/api/evidence` and waits before returning the tool result to ElevenLabs. Photos added after that id exist upload immediately. A photo with an `evidenceId` is never uploaded again.

## Phone / microphone

Camera, library, and microphone need `localhost` or `https`. A bare `http://192.168.x.x` LAN IP will silently fail `getUserMedia`. For a phone demo use the Render URL or a tunnel.
