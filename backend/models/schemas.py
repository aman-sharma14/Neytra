"""
schemas.py — Pydantic request/response models for every Neytra endpoint.

All routers import from here. Keeps the shape of data in one place so
any team member can read what each endpoint expects and returns.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ── /scene ─────────────────────────────────────────────────────────────────────

class SceneRequest(BaseModel):
    frame: str = Field(..., description="Base64-encoded JPEG frame from the camera")
    location_id: Optional[str] = Field(
        None, description="If provided, cross-reference against saved memory for this location"
    )
    use_nim: bool = Field(False, description="Use NVIDIA NIM instead of Gemini")


class SceneResponse(BaseModel):
    narration: str
    hazard: bool
    hazard_type: Optional[str] = None


# ── /face ──────────────────────────────────────────────────────────────────────

class FaceRequest(BaseModel):
    frame: str = Field(..., description="Base64-encoded JPEG frame")


class FacePosition(BaseModel):
    top: int
    right: int
    bottom: int
    left: int


class FaceResult(BaseModel):
    name: Optional[str] = None       # None if unknown
    emotion: Optional[str] = None    # e.g. "looks happy"
    position: FacePosition
    known: bool
    encoding_hash: Optional[str] = None  # used for dedup/timer keying
    should_announce: bool = False    # true when the timer threshold was met


class FaceResponse(BaseModel):
    faces: list[FaceResult]


# ── /command ───────────────────────────────────────────────────────────────────

class CommandRequest(BaseModel):
    text: str = Field(..., description="Raw voice command text from the browser")
    frame: Optional[str] = Field(None, description="Current camera frame (base64), used for scene-aware commands")
    use_nim: bool = Field(False, description="Use NVIDIA NIM instead of Gemini")


class CommandResponse(BaseModel):
    action: str     # e.g. "scene_describe", "navigate", "remember", "face_identify", "stop", "unknown"
    response: str   # Text to be spoken back to the user


# ── /memory ────────────────────────────────────────────────────────────────────

class WaypointSaveRequest(BaseModel):
    location_id: str = Field(..., description="Slug identifier e.g. 'college_canteen_entrance'")
    description: str = Field(..., description="Natural-language description of this step")
    landmark: bool = Field(False, description="True if this is a notable landmark step")


class WaypointSaveResponse(BaseModel):
    success: bool
    waypoint_count: int


class Waypoint(BaseModel):
    step: int
    description: str
    landmark: bool
    timestamp: str


class MemoryGetResponse(BaseModel):
    location_id: str
    created: str
    waypoints: list[Waypoint]


class LocationSummary(BaseModel):
    location_id: str
    display_name: str
    waypoint_count: int
    created: str


class MemoryListResponse(BaseModel):
    locations: list[LocationSummary]


# ── /enroll ────────────────────────────────────────────────────────────────────

class EnrollRequest(BaseModel):
    frame: str = Field(..., description="Base64-encoded JPEG frame with exactly one face")
    name: str = Field(..., description="Name to associate with this face")


class EnrollResponse(BaseModel):
    success: bool
    message: str


# ── /scan (unified lightweight scan) ──────────────────────────────────────────

class ScanRequest(BaseModel):
    frame: str = Field(..., description="Base64-encoded JPEG frame from the camera")


class ScanResponse(BaseModel):
    labels: str = Field(..., description="Short spatial summary, e.g. 'bike on left, person ahead'")
    hazard: bool
    hazard_type: Optional[str] = None
    person_detected: bool = False
    faces: list[FaceResult] = []
