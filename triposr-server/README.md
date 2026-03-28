# TripoSR Server

Converts a photo into a GLB 3D model using [TripoSR](https://github.com/VAST-AI-Research/TripoSR) (Stability AI), then serves the file to the Mover app so items render as real shapes in the Pack Planner.

## Requirements

- Python 3.9+
- ~3 GB disk space (model weights)
- 16 GB RAM recommended (runs on CPU, no GPU required)

## Setup (one time)

```bash
cd triposr-server
bash setup.sh
```

This will:
1. Create a `.venv` virtual environment
2. Install FastAPI, rembg, trimesh, torch, etc.
3. Clone TripoSR from GitHub
4. Download the `stabilityai/TripoSR` weights from HuggingFace (~2.5 GB)

## Start the server

```bash
cd triposr-server
source .venv/bin/activate
python main.py
```

Server runs at **http://localhost:8765**

| Endpoint | Description |
|---|---|
| `GET /health` | Returns `{ status, modelLoaded, device }` |
| `POST /generate` | Accepts `multipart/form-data` with `file` field, returns `{ url, id }` |
| `GET /models/<id>.glb` | Download a generated model |

## How it works

1. Image uploaded → background removed (rembg) → fed to TripoSR
2. TripoSR infers a 3D mesh (resolution 256)
3. Mesh exported as GLB to `models/` directory
4. URL returned to Mover app and stored on the inventory item
5. Pack Planner loads the GLB via Three.js `GLTFLoader`, falls back to procedural shape if server is offline

## Performance

| Hardware | Time per item |
|---|---|
| Apple M-series (CPU) | ~15–25 seconds |
| NVIDIA GPU (CUDA) | ~2–4 seconds |
| Intel CPU | ~40–90 seconds |

## Troubleshooting

**`ModuleNotFoundError: tsr`** — run `pip install -e TripoSR` inside the venv

**`RuntimeError: CUDA out of memory`** — set `CUDA_VISIBLE_DEVICES=""` to force CPU mode

**Port conflict** — change `port=8765` in `main.py`
