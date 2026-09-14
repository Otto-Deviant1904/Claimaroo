# =============================================================================
# Claimaroo Vehicle Vision — serving cell (paste into the Colab notebook AFTER
# training finishes). Serves best.pt behind FastAPI and prints a public
# LOCAL_VISION_URL via a cloudflared tunnel (no account needed).
#
# Contract (matches src/lib/analyse.ts localModelAnalyse):
#   POST /analyse  {"filename", "mime_type", "image_base64"}
#   -> {"observations": [str], "findings": [{area, observation, severity, source}]}
# =============================================================================

!pip install -q ultralytics fastapi uvicorn nest_asyncio
!wget -q -O /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && chmod +x /usr/local/bin/cloudflared

import base64, io, json, re, subprocess, threading, time

import nest_asyncio
import uvicorn
from fastapi import FastAPI, HTTPException
from PIL import Image
from ultralytics import YOLO

MODEL_PATH = "runs/detect/train/weights/best.pt"  # adjust if your run folder differs

# Honest mapping: this dataset labels car PARTS, not damage types, and
# Bumper/Door/Light/Fender are ambiguous without side info. Claimaroo's
# mapZone() needs left/right qualifiers to light the diagram, so those
# zones show as text findings instead of guessed map zones.
PART_TO_ZONE = {
    "Bonnet": "front",
    "Windshield": "windscreen",
    "Dickey": "rear",
    "Fender": "side (unspecified)",
    "Door": "side (unspecified)",
    "Bumper": "front-or-rear (unspecified)",
    "Light": "headlight (unspecified side)",
}

model = YOLO(MODEL_PATH)
class_names = model.names

# Stock COCO model, used only as a "does this show a vehicle?" gate. The
# damage model hallucinates parts on people/rooms; this keeps non-vehicle
# uploads from producing confident nonsense (they fall through to cloud
# vision instead, which describes what's actually in the image).
vehicle_model = YOLO("yolov8n.pt")
VEHICLE_COCO_IDS = {1, 2, 3, 5, 7}  # bicycle, car, motorcycle, bus, truck
MIN_DETECTION_CONF = 0.30


def vehicle_present(pil_image):
    for result in vehicle_model.predict(pil_image, verbose=False):
        for box in result.boxes:
            if int(box.cls) in VEHICLE_COCO_IDS and float(box.conf) >= 0.30:
                return True
    return False


def analysis_confidence(findings):
    if not findings:
        return "low"
    best = max(f["det_conf"] for f in findings)
    if best >= 0.65:
        return "high"
    if best >= 0.45:
        return "medium"
    return "low"


def severity_from_box_area(box, img_w, img_h):
    """Box-area heuristic placeholder — dataset has no severity labels."""
    x1, y1, x2, y2 = box.xyxy[0].tolist()
    frac = ((x2 - x1) * (y2 - y1)) / (img_w * img_h)
    if frac > 0.15:
        return "severe"
    if frac > 0.05:
        return "moderate"
    return "minor"


app = FastAPI(title="Claimaroo Vehicle Vision")


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_PATH}


@app.post("/analyse")
def analyse(payload: dict):
    try:
        image = Image.open(io.BytesIO(base64.b64decode(payload.get("image_base64", ""))))
        image.load()
    except Exception:
        raise HTTPException(status_code=400, detail="image_base64 is not a decodable image")

    findings = []
    best_conf = 0.0
    for result in model.predict(image, verbose=False):
        img_h, img_w = result.orig_shape
        for box in result.boxes:
            conf = float(box.conf)
            best_conf = max(best_conf, conf)
            if conf < MIN_DETECTION_CONF:
                continue
            part = class_names[int(box.cls)]
            findings.append({
                "area": PART_TO_ZONE.get(part, part.lower()),
                "observation": f"Detected {part.lower()} damage, confidence {conf:.2f}.",
                "severity": severity_from_box_area(box, img_w, img_h),
                "source": "local_model",
                "det_conf": conf,
            })

    # Gate: accept only if a vehicle is visible OR a part detection is strong
    # enough to imply a car (close-ups of damage often show no full vehicle —
    # calibrated on a selfie whose strongest hallucinated box scored 0.26).
    if not (vehicle_present(image) or best_conf >= 0.35):
        return {"observations": [], "findings": []}

    confidence = analysis_confidence(findings)

    if not findings:
        findings = [{
            "area": "observed",
            "observation": "Vehicle present but no damage parts detected by the local model.",
            "severity": "unknown",
            "source": "local_model",
        }]
        confidence = "low"
        return {"observations": [findings[0]["observation"]],
                "findings": [{k: v for k, v in findings[0].items() if k != "det_conf"}],
                "confidence": confidence}

    return {"observations": [f["observation"] for f in findings],
            "findings": [{k: v for k, v in f.items() if k != "det_conf"} for f in findings],
            "confidence": confidence}


nest_asyncio.apply()
threading.Thread(
    target=uvicorn.run, args=(app,), kwargs={"host": "127.0.0.1", "port": 8000, "log_level": "warning"},
    daemon=True,
).start()
time.sleep(3)

tunnel = subprocess.Popen(
    ["/usr/local/bin/cloudflared", "tunnel", "--url", "http://127.0.0.1:8000", "--no-autoupdate"],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
)
url = None
deadline = time.time() + 60
while time.time() < deadline and url is None:
    line = tunnel.stdout.readline()
    m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", line or "")
    if m:
        url = m.group(0)
if not url:
    raise RuntimeError("cloudflared did not produce a URL — rerun this cell")

import requests
health = requests.get(f"{url}/health", timeout=30).json()
print("tunnel:", url)
print("health:", health)
print()
print("Set this in Claimaroo (.env.local locally, LOCAL_VISION_URL in Vercel):")
print(f'LOCAL_VISION_URL={url}/analyse')
print()
print("NOTE: the trycloudflare URL changes every time you rerun this cell —")
print("update LOCAL_VISION_URL after each restart. Colab also disconnects idle")
print("runtimes, so start the tunnel shortly before your demo.")
