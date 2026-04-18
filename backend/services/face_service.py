"""
face_service.py — Face recognition with timer-gated announcement logic.

Timer logic (from doc.md §5.3):
  - Known face → announce after 3 seconds of continuous visibility
  - Unknown face → prompt enrollment after 8 seconds
  - After announcing, reset the timer (re-appearance = new event)

This module is pure Python — no FastAPI, no I/O.
Routers call process_frame() which does the full pipeline.
"""

import base64
import hashlib
import pickle
import time
import face_recognition
import numpy as np
import cv2
from pathlib import Path
from config import (
    FACE_DB_PATH,
    FACE_ANNOUNCE_THRESHOLD,
    FACE_ENROLL_THRESHOLD,
    FACE_RECOGNITION_TOLERANCE,
)

# In-memory timer state — { encoding_hash: first_seen_timestamp }
_face_timers: dict[str, float] = {}

# Face database — loaded at startup, updated on enroll
_known_encodings: list[np.ndarray] = []
_known_names: list[str] = []


def _load_face_db() -> None:
    """Load face encodings from disk into module-level lists."""
    global _known_encodings, _known_names
    if FACE_DB_PATH.exists():
        with open(FACE_DB_PATH, "rb") as f:
            data = pickle.load(f)
            _known_encodings = data.get("encodings", [])
            _known_names = data.get("names", [])
    else:
        _known_encodings = []
        _known_names = []


def _save_face_db() -> None:
    """Persist the in-memory face DB to disk."""
    FACE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(FACE_DB_PATH, "wb") as f:
        pickle.dump({"encodings": _known_encodings, "names": _known_names}, f)


def _encoding_hash(encoding: np.ndarray) -> str:
    """Stable short hash of a face encoding used as a dict key."""
    return hashlib.md5(encoding.tobytes()).hexdigest()[:12]


from PIL import Image
import io

def decode_frame(base64_frame: str) -> np.ndarray | None:
    """Decode a base64 JPEG to an RGB numpy array (face_recognition format)."""
    try:
        pad = len(base64_frame) % 4
        if pad:
            base64_frame += "=" * (4 - pad)
        img_bytes = base64.b64decode(base64_frame)
        # Using PIL guarantees standard 8-bit RGB buffers for dlib/hog C++
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        return np.array(image, dtype=np.uint8)
    except Exception:
        return None


def extract_face_crops(rgb_image: np.ndarray, locations: list) -> list[np.ndarray]:
    """Return cropped BGR images for each face location (for DeepFace)."""
    crops = []
    bgr = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
    for (top, right, bottom, left) in locations:
        crop = bgr[top:bottom, left:right]
        crops.append(crop)
    return crops


def process_frame(base64_frame: str) -> list[dict]:
    """
    Full face processing pipeline for one camera frame.

    Returns a list of face dicts (only those that have cleared their timer):
        {
            name: str | None,
            known: bool,
            encoding_hash: str,
            position: { top, right, bottom, left },
            should_announce: bool,
            should_enroll_prompt: bool,
            face_crop: np.ndarray,   # BGR, for emotion detection
        }
    """
    _load_face_db()  # refresh in case enroll happened concurrently
    now = time.time()

    rgb = decode_frame(base64_frame)
    if rgb is None or rgb.shape[0] < 10 or rgb.shape[1] < 10:
        return []
        
    rgb = np.ascontiguousarray(rgb, dtype=np.uint8)

    # Use the image directly for locations since we already downscale in the frontend
    locations = face_recognition.face_locations(rgb, model="hog")

    if not locations:
        return []

    encodings = face_recognition.face_encodings(rgb, locations)
    crops = extract_face_crops(rgb, locations)

    results = []
    for encoding, location, crop in zip(encodings, locations, crops):
        enc_hash = _encoding_hash(encoding)

        # Match against known faces
        matches = face_recognition.compare_faces(
            _known_encodings, encoding, tolerance=FACE_RECOGNITION_TOLERANCE
        )
        known = any(matches)
        name: str | None = None
        if known:
            distances = face_recognition.face_distance(_known_encodings, encoding)
            best_idx = int(np.argmin(distances))
            name = _known_names[best_idx]

        # Timer logic
        if enc_hash not in _face_timers:
            _face_timers[enc_hash] = now

        elapsed = now - _face_timers[enc_hash]
        should_announce = known and elapsed >= FACE_ANNOUNCE_THRESHOLD
        should_enroll = not known and elapsed >= FACE_ENROLL_THRESHOLD

        if should_announce or should_enroll:
            # Reset timer so re-appearance is a new event
            _face_timers.pop(enc_hash)

        top, right, bottom, left = location
        results.append({
            "name": name,
            "known": known,
            "encoding_hash": enc_hash,
            "position": {"top": top, "right": right, "bottom": bottom, "left": left},
            "should_announce": should_announce,
            "should_enroll_prompt": should_enroll,
            "face_crop": crop,
        })

    # Sort: known faces first, then unknowns
    results.sort(key=lambda x: 0 if x["known"] else 1)
    return results


def enroll_face(base64_frame: str, name: str) -> tuple[bool, str]:
    """
    Extract a face encoding from the frame and add it to the database.
    Returns (success, message).
    """
    _load_face_db()
    try:
        rgb = decode_frame(base64_frame)
        if rgb is None or rgb.shape[0] < 10 or rgb.shape[1] < 10:
            return False, "Could not decode camera frame."
        locations = face_recognition.face_locations(rgb)
        if not locations:
            return False, "No face detected in the frame."
        if len(locations) > 1:
            return False, f"Multiple faces detected ({len(locations)}). Please enroll one face at a time."
        encoding = face_recognition.face_encodings(rgb, locations)[0]
        _known_encodings.append(encoding)
        _known_names.append(name.strip())
        _save_face_db()
        return True, f"Face enrolled for '{name}'."
    except Exception as exc:
        return False, f"Enrollment failed: {str(exc)[:100]}"
