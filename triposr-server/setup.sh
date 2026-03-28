#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Setup script for TripoSR server
# Run once: bash setup.sh
# ---------------------------------------------------------------------------
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Creating Python virtual environment..."
python3 -m venv .venv
source .venv/bin/activate

echo "==> Installing base requirements..."
pip install --upgrade pip
pip install -r requirements.txt

echo "==> Cloning TripoSR source..."
if [ ! -d "TripoSR" ]; then
  git clone https://github.com/VAST-AI-Research/TripoSR.git
fi

echo "==> Installing TripoSR package..."
pip install -e TripoSR

echo "==> Downloading model weights (~2.5 GB, may take a few minutes)..."
python3 - <<'EOF'
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id="stabilityai/TripoSR",
    local_dir="weights",
    ignore_patterns=["*.md"],
)
print("Weights downloaded to ./weights/")
EOF

echo ""
echo "✅  Setup complete!"
echo ""
echo "To start the server:"
echo "  source .venv/bin/activate"
echo "  python main.py"
echo ""
echo "The server runs at http://localhost:8765"
echo "Health check: curl http://localhost:8765/health"
