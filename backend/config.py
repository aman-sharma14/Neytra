"""
config.py — Centralised configuration for Neytra backend.

All environment variables are loaded here. Import `settings` from this module
everywhere else. Never read os.environ directly in routers or services.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent

FACE_DB_PATH: Path = Path(os.getenv("FACE_DB_PATH", str(BASE_DIR / "data/faces/encodings.pkl")))
MEMORY_DIR: Path = Path(os.getenv("MEMORY_DIR", str(BASE_DIR / "data/memory")))

# Ensure directories exist at startup
FACE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
MEMORY_DIR.mkdir(parents=True, exist_ok=True)

# ── API Keys ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "")

# ── CORS ───────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
CORS_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",")]

# ── Face recognition thresholds ────────────────────────────────────────────────
FACE_ANNOUNCE_THRESHOLD: float = 3.0   # seconds — announce known face
FACE_ENROLL_THRESHOLD: float = 8.0     # seconds — prompt enroll for unknown
FACE_RECOGNITION_TOLERANCE: float = 0.5

# ── Scene narration interval ───────────────────────────────────────────────────
SCENE_INTERVAL_SECONDS: int = 3

# ── YOLO ───────────────────────────────────────────────────────────────────────
YOLO_MODEL: str = "yolov8n.pt"          # nano — fast for real-time
YOLO_CONFIDENCE: float = 0.45
HAZARD_CLASSES: set[str] = {
    "person", "bicycle", "car", "motorcycle", "bus", "truck",
    "stop sign", "stairs", "fire hydrant"
}
