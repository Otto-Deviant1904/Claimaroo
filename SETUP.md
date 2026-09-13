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

# Optional live photo analysis. OpenAI or DeepSeek (OpenAI-compatible) work.
# DeepSeek:
#   OPENAI_API_KEY=sk-...
#   OPENAI_BASE_URL=https://api.deepseek.com
#   OPENAI_VISION_MODEL=deepseek-flash
#   LLM_PROVIDER=openai
# AgentRouter credits do NOT work here (rejects non–Claude-Code clients).
```

`/api/elevenlabs/token` returns `{ agentId }` when `ELEVENLABS_AGENT_PUBLIC=true`. Otherwise it mints a conversation token with the API key.

Permissive CORS on `/api/claims` and unauthenticated customer lookup are demo-only. They are not production security controls. Do not treat them as an auth system.

## Photos

The customer must add at least one photo before Start the call. Bytes stay in the browser until `create_claim` returns a real Postgres `claimId`. The page then POSTs each pending file to `/api/evidence` and waits before returning the tool result to ElevenLabs. Photos added after that id exist upload immediately. A photo with an `evidenceId` is never uploaded again.

## Phone / microphone

Camera, library, and microphone need `localhost` or `https`. A bare `http://192.168.x.x` LAN IP will silently fail `getUserMedia`. For a phone demo use the Render or Vercel URL, or a tunnel.

## Tests

See [`docs/test-plan.md`](docs/test-plan.md).

```bash
npm test              # unit (no database)
npm run test:api      # every API route (needs DATABASE_URL + seed)
npm run test:e2e      # Playwright pages (needs DATABASE_URL + seed)
npm run test:all
BASE_URL=https://your-host npm run smoke
```

## Deploy (Render or Vercel)

The Next.js app is the website. Postgres is separate (`DATABASE_URL`). Do not host the Next app on Supabase; you can use Supabase **as the database**.

Required for a working demo:

- `DATABASE_URL` — hosted Postgres URI with `sslmode=require`. Use the **direct / session** port **5432**, not the transaction pooler (**6543**).
- `ELEVENLABS_AGENT_ID`
- `ELEVENLABS_AGENT_PUBLIC=true` (leave `ELEVENLABS_API_KEY` empty while the agent is public)

Run schema + seed **once** against that database:

```bash
DATABASE_URL='postgresql://…?sslmode=require' npm run db:release
```

**Render:** Blueprint in `render.yaml`. `DATABASE_URL` is attached automatically if you use the Blueprint database, or paste a Supabase/Neon URI instead.

**Vercel:** Import the GitHub repo. Set the same env vars. Vercel does not include Postgres. Hobby multipart uploads cap around **4.5MB**; the app still allows 10MB on Render. `analyse_damage` may need a 60s function limit (Pro) if a cloud vision key is set.

Phone and PC open the **https Next.js origin** (`/claim`, `/claims`), not `*.supabase.co`.

