"""
emotion_service.py — DeepFace emotion detection on face crops.

Only called when a face clears the 3-second announce timer.
Wrapped entirely in try/except — if DeepFace fails, narration
continues without emotion (graceful degradation).
"""

import numpy as np

# Lazy import so startup isn't delayed if deepface isn't installed
_deepface = None


def _get_deepface():
    global _deepface
    if _deepface is None:
        try:
            from deepface import DeepFace
            _deepface = DeepFace
        except ImportError:
            _deepface = False  # sentinel: not available
    return _deepface


_EMOTION_MAP: dict[str, str] = {
    "happy": "looks happy",
    "sad": "seems a bit down",
    "angry": "seems tense",
    "surprise": "looks surprised",
    "neutral": "",           # say nothing — "looks neutral" sounds robotic
    "fear": "seems anxious",
    "disgust": "seems uncomfortable",
}


def get_emotion(face_crop: np.ndarray) -> str:
    """
    Analyse a BGR face crop image with DeepFace.

    Returns a natural-language emotion phrase (e.g. "looks happy"),
    or an empty string if emotion is neutral or detection fails.
    """
    deepface = _get_deepface()
    if not deepface:
        return ""

    try:
        result = deepface.analyze(
            face_crop,
            actions=["emotion"],
            enforce_detection=False,
            silent=True,
        )
        dominant = result[0]["dominant_emotion"]
        return _EMOTION_MAP.get(dominant, "")
    except Exception:
        return ""
