# Local Vehicle Vision (LOCAL_VISION_URL)

The `analyse_damage` tool can call a locally-run damage detector before
falling back to cloud vision. This is wired via the `LOCAL_VISION_URL`
environment variable (see `.env.example`). The repo doesn't ship the
service or weights — they're run separately, on the developer's machine
or any always-on host.

## Contract

Request: `POST <LOCAL_VISION_URL>` with JSON
```
{ "filename": string, "mime_type": string, "image_base64": string }
```
Response: JSON
```
{
  "observations": [string],
  "findings": [{ "area", "observation", "severity", "source" }],
  "confidence": "low" | "medium" | "high"            // optional
}
```

`source` must be `local_model` (the app overwrites it). Anything else is
ignored.

## Behaviour

`src/lib/analyse.ts localModelAnalyse()` calls the service with an 8s
timeout, maps the response into `DamageFinding[]`, and falls through to
GPT-4o-mini (or filename heuristics) if the service is unreachable,
returns nothing, or errors. Failures are silent on purpose so the
fallback chain works without operator action.

The current local service also runs a vehicle-presence gate (stock COCO
model) before invoking the damage model — non-vehicle uploads return
empty so the waterfall reaches cloud vision instead of hallucinating
car parts on a selfie.

## Where it runs in this build

For the Forward 2026 hackathon build, the model and the tunnel live on
the developer's laptop:

| Piece | Location |
|---|---|
| Service code | `~/Downloads/claimaroo-test/vision-service/service.py` |
| Weights | `runs/detect/car-damage-runs/yolov8n-local/weights/best.pt` |
| Local URL | `http://127.0.0.1:8901` |
| Public URL | `https://lakes-differential-advances-def.trycloudflare.com/analyse` (trycloudflare ephemeral — **changes on every tunnel restart**) |
| Env on Vercel | `LOCAL_VISION_URL=<public URL>/analyse` |

The model is **YOLOv8n** fine-tuned on the Roboflow *Car Damage
Detection by CAPSTONE* dataset (workspace `capstone-nh0nc`, project
`car-damage-detection-t0g92`, version 4 — 6,800 train images, 7
part classes: Bonnet, Bumper, Dickey, Door, Fender, Light, Windshield).
Trained locally on an RTX 4050 (best at epoch 19 / 27, mAP50 0.526).
Severities are a box-area heuristic — the dataset has no severity
labels.

## Demo script

```
cd ~/Downloads/claimaroo-test/vision-service
MODEL_PATH=runs/detect/car-damage-runs/yolov8n-local/weights/best.pt \
  .venv/bin/uvicorn service:app --host 127.0.0.1 --port 8901 &
~/Downloads/claimaroo-test/bin/cloudflared tunnel --url http://127.0.0.1:8901 --no-autoupdate
```

Then paste the printed URL into Vercel as `LOCAL_VISION_URL` and
redeploy. The officer view shows the source of each assessment
(`local_model`, `vision`, or `heuristic`) so the demo can prove which
one ran.

## Stable URL for production

`trycloudflare.com` URLs die with the process. For an always-on
deployment, host `service.py` and `best.pt` on any persistent host
(Render free tier, Hugging Face Spaces, Fly.io, a small VPS), set
`LOCAL_VISION_URL` to its `/analyse` endpoint, and the URL never
changes again. The service is stateless, GPU-friendly, and ~1.3ms
inference per image on a 4050-class GPU.
