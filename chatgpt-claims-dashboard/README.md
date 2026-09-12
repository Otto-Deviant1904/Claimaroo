# ChatGPT claims dashboard demo

Static prototype produced in a ChatGPT session ("Claims Dashboard Demo") and published at
https://claimdesk-derek-demo.derekc2405.chatgpt.site. These are the exact built files
recovered from that deployment (the Cloudflare script injected by the host has been stripped
from the HTML). ChatGPT's private `.openai/hosting.json` deploy config was not recoverable and
is not needed to run the site.

Plain HTML/CSS/JS, no build step. Demo data lives in `model.js`; officer actions are saved to
`localStorage` in the browser.

## Files

| Path | Role |
|---|---|
| `index.html` | Page shell (dashboard + case view containers) |
| `app.js` | Routing, dashboard rendering, filters, case review actions |
| `model.js` | `ClaimModel`: statuses, demo fixtures (`CLM-DEMO-A/B/C`), storage helpers |
| `style.css` | Styles |
| `claims/**/index.html` | Copies of the shell so `/claims/` and `/claims/CLM-DEMO-*/` load on static hosts |

## Run

Asset paths are absolute (`/app.js`), so serve this folder as the web root:

```bash
cd chatgpt-claims-dashboard
python3 -m http.server 8765
# open http://localhost:8765/claims/
```

## Live backend (integrated)

`backend.js` (loaded after `app.js`) connects the dashboard to the Next API
(default `http://localhost:3000`, override with `window.CLAIM_API_BASE`):

- `GET /api/claims` + `GET /api/claims/[id]` replace fixtures; footer shows
  "Live backend connected". Unreachable backend falls back to fixtures.
- Officer actions `POST /api/claims/[id]/actions` first, then fall back to
  the local `ClaimModel.applyAction` when offline.
- Completes the `ClaimModel.STATUS` enum (`human_review`, `urgent`) so live
  triage routes render.
- Requires CORS on the claims endpoints (see `src/lib/cors.ts`).
