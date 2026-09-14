# Claimaroo vehicle vision notebooks

Training and Colab serve helpers for the local damage model (`LOCAL_VISION_URL`).

| File | Purpose |
| --- | --- |
| `colab_nb.ipynb` | Primary Colab notebook — train YOLOv8n on the Roboflow car-damage set, then serve |
| `car-damage-yolo.ipynb` | Same pipeline (local / Colab twin) |
| `colab-serve-cell.py` | Standalone paste cell: FastAPI + cloudflared → prints `LOCAL_VISION_URL` |

## Colab quick start

1. Upload `colab_nb.ipynb` to [Google Colab](https://colab.research.google.com/) (Runtime → GPU).
2. Set `ROBOFLOW_API_KEY` in the data cell (do not commit real keys).
3. Run train cells, then the **Serve for Claimaroo** cell.
4. Paste the printed `LOCAL_VISION_URL=https://….trycloudflare.com/analyse` into Vercel / `.env.local`.

Ops notes (laptop uvicorn + tunnel): `~/Downloads/claimaroo-test/README.md`.
Contract: `src/lib/analyse.ts` `localModelAnalyse`.
