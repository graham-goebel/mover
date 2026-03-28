"""
TripoSR local server for Mover app.
Accepts an image, runs TripoSR, returns a GLB download URL.

Usage:
  python main.py          # starts on http://localhost:8765
"""

import io
import os
import sys
import uuid
import logging
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model loading (lazy on first request so the server starts instantly)
# ---------------------------------------------------------------------------
_model = None
_rembg_session = None
_device = "cpu"

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)


def get_model():
    global _model, _rembg_session, _device
    if _model is not None:
        return _model

    import torch
    _device = "cuda" if torch.cuda.is_available() else "cpu"
    log.info(f"Loading TripoSR on {_device} ...")

    try:
        from tsr.system import TSR
        from tsr.utils import remove_background, resize_foreground
    except ImportError:
        raise RuntimeError(
            "TripoSR is not installed. Run: pip install -r requirements.txt"
        )

    _model = TSR.from_pretrained(
        "stabilityai/TripoSR",
        config_name="config.yaml",
        weight_name="model.ckpt",
    )
    _model.renderer.set_chunk_size(131072)
    _model.to(_device)
    log.info("TripoSR ready.")

    import rembg
    _rembg_session = rembg.new_session()
    return _model


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="TripoSR Server", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/models", StaticFiles(directory=str(MODELS_DIR)), name="models")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "modelLoaded": _model is not None,
        "device": _device,
    }


@app.post("/generate")
async def generate(file: UploadFile = File(...)):
    """
    Accept an image (JPEG/PNG/WebP/etc.), run TripoSR, return GLB URL.
    Response: { "url": "http://localhost:8765/models/<id>.glb", "id": "<id>" }
    """
    import torch
    from tsr.utils import remove_background, resize_foreground

    # ---------- load image ----------
    try:
        data = await file.read()
        image = Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read image: {e}")

    log.info(f"Received image {image.size}, running background removal ...")

    # ---------- preprocess ----------
    try:
        image = remove_background(image, _rembg_session)
        image = resize_foreground(image, 0.85)
    except Exception as e:
        log.warning(f"Background removal failed ({e}), using original image")
        # fall back to original if rembg fails
        pass

    model = get_model()

    # ---------- inference ----------
    log.info("Running TripoSR inference ...")
    try:
        with torch.no_grad():
            scene_codes = model([image], device=_device)
        meshes = model.extract_mesh(scene_codes, resolution=256)
    except Exception as e:
        log.error(f"TripoSR inference failed: {e}")
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")

    # ---------- export GLB ----------
    model_id = str(uuid.uuid4())
    out_path = MODELS_DIR / f"{model_id}.glb"
    try:
        meshes[0].export(str(out_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {e}")

    log.info(f"Exported {out_path.name} ({out_path.stat().st_size // 1024} KB)")

    url = f"http://localhost:8765/models/{model_id}.glb"
    return JSONResponse({"url": url, "id": model_id})


# ---------------------------------------------------------------------------
# Startup: pre-warm model so first request isn't slow
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    import asyncio
    asyncio.get_event_loop().run_in_executor(None, get_model)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765, log_level="info")
