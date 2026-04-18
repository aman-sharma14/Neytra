"""
main.py — Neytra FastAPI application entry point.

Mounts all feature routers. Each router is independently owned
by a team member. Adding a new feature = create a new router file
and add one line here.

Run:
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from routers import scene, face, command, memory, enroll, scan

app = FastAPI(
    title="Neytra API",
    description="AI-Powered Spatial Companion for the Visually Impaired",
    version="1.0.0",
)

# ── CORS — allow React dev server ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Feature routers ───────────────────────────────────────────────────────────
app.include_router(scene.router)
app.include_router(face.router)
app.include_router(command.router)
app.include_router(memory.router)
app.include_router(enroll.router)
app.include_router(scan.router)


# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
def health():
    """Lightweight ping endpoint for uptime monitors."""
    return {"status": "ok", "service": "neytra-backend"}


# ── Root ───────────────────────────────────────────────────────────────────────
@app.get("/", tags=["root"])
def root():
    return {
        "message": "Neytra API is running.",
        "docs": "/docs",
        "endpoints": ["/scan", "/scene", "/face", "/command", "/memory", "/enroll"],
    }
