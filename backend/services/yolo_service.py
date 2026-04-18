"""
yolo_service.py — YOLOv8-based hazard detection.

Loads the model once at module import (singleton). Routers call
detect_hazards() and get back a simple bool + hazard type.
"""

import base64
import numpy as np
import cv2
from ultralytics import YOLO
from config import YOLO_MODEL, YOLO_CONFIDENCE, HAZARD_CLASSES

# Singleton — loaded once when the backend starts
_model: YOLO | None = None


def _get_model() -> YOLO:
    global _model
    if _model is None:
        _model = YOLO(YOLO_MODEL)
    return _model


def base64_to_cv2(base64_frame: str) -> np.ndarray:
    """Decode a base64 JPEG string to an OpenCV BGR image."""
    img_bytes = base64.b64decode(base64_frame)
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def detect_hazards(base64_frame: str) -> tuple[bool, str | None]:
    """
    Run YOLOv8 on the frame and check for priority hazard classes.

    Returns:
        (hazard_detected: bool, hazard_type: str | None)
        hazard_type is the most critical class name found, or None.
    """
    try:
        img = base64_to_cv2(base64_frame)
        model = _get_model()
        results = model(img, conf=YOLO_CONFIDENCE, verbose=False)

        detected_classes: list[str] = []
        for result in results:
            for cls_id in result.boxes.cls.tolist():
                cls_name = model.names[int(cls_id)]
                if cls_name in HAZARD_CLASSES:
                    detected_classes.append(cls_name)

        if detected_classes:
            # Priority order: stairs > vehicles > people
            priority = ["stairs", "step", "car", "bus", "truck", "motorcycle", "bicycle", "person"]
            for p in priority:
                if p in detected_classes:
                    return True, p
            return True, detected_classes[0]

        return False, None

    except Exception:
        return False, None


def get_all_detections(base64_frame: str) -> list[dict]:
    """
    Return all YOLO detections (class name + confidence + bounding box).
    Used by /face router to get bounding boxes for face overlay alignment.
    """
    try:
        img = base64_to_cv2(base64_frame)
        model = _get_model()
        results = model(img, conf=YOLO_CONFIDENCE, verbose=False)
        detections = []
        h, w = img.shape[:2]
        for result in results:
            for box, cls_id, conf in zip(
                result.boxes.xyxy.tolist(),
                result.boxes.cls.tolist(),
                result.boxes.conf.tolist(),
            ):
                detections.append({
                    "class": model.names[int(cls_id)],
                    "confidence": round(float(conf), 2),
                    "box": {
                        "x1": int(box[0]), "y1": int(box[1]),
                        "x2": int(box[2]), "y2": int(box[3]),
                    },
                })
        return detections
    except Exception:
        return []


def _get_zone(box: dict, frame_width: int) -> str:
    """Map a bounding box center-x to left / center / right."""
    cx = (box["x1"] + box["x2"]) / 2
    third = frame_width / 3
    if cx < third:
        return "on left"
    elif cx < 2 * third:
        return "ahead"
    else:
        return "on right"


# Friendly display names for YOLO classes
_CLASS_ALIASES = {
    "cell phone": "phone",
    "traffic light": "signal",
    "fire hydrant": "hydrant",
    "stop sign": "stop sign",
    "potted plant": "plant",
    "dining table": "table",
    "baseball bat": "bat",
    "baseball glove": "glove",
    "tennis racket": "racket",
    "wine glass": "glass",
}


def detections_to_spatial_labels(detections: list[dict], frame_width: int) -> str:
    """
    Convert YOLO detections to a short spatial string.
    Example: "bike on left, person ahead, car on right"
    Deduplicates by (class, zone).
    """
    if not detections:
        return "path clear"

    seen = set()
    parts = []
    for det in detections:
        cls = det["class"]
        zone = _get_zone(det["box"], frame_width)
        key = (cls, zone)
        if key in seen:
            continue
        seen.add(key)
        label = _CLASS_ALIASES.get(cls, cls)
        parts.append(f"{label} {zone}")

    return ", ".join(parts) if parts else "path clear"


def detect_with_positions(base64_frame: str) -> dict:
    """
    Run YOLO once and return hazard info + spatial labels + raw detections.

    Returns:
        {
            "hazard": bool,
            "hazard_type": str | None,
            "labels": str,             # "bike on left, person ahead"
            "person_detected": bool,
            "detections": list[dict],   # raw detection dicts
        }
    """
    try:
        img = base64_to_cv2(base64_frame)
        model = _get_model()
        results = model(img, conf=YOLO_CONFIDENCE, verbose=False)

        h, w = img.shape[:2]
        detections = []
        hazard_classes = []
        person_detected = False

        for result in results:
            for box, cls_id, conf in zip(
                result.boxes.xyxy.tolist(),
                result.boxes.cls.tolist(),
                result.boxes.conf.tolist(),
            ):
                cls_name = model.names[int(cls_id)]
                det = {
                    "class": cls_name,
                    "confidence": round(float(conf), 2),
                    "box": {
                        "x1": int(box[0]), "y1": int(box[1]),
                        "x2": int(box[2]), "y2": int(box[3]),
                    },
                }
                detections.append(det)

                if cls_name in HAZARD_CLASSES:
                    hazard_classes.append(cls_name)
                if cls_name == "person":
                    person_detected = True

        # Hazard priority
        hazard = False
        hazard_type = None
        if hazard_classes:
            hazard = True
            priority = ["stairs", "step", "car", "bus", "truck",
                         "motorcycle", "bicycle", "person"]
            for p in priority:
                if p in hazard_classes:
                    hazard_type = p
                    break
            if hazard_type is None:
                hazard_type = hazard_classes[0]

        labels = detections_to_spatial_labels(detections, w)

        return {
            "hazard": hazard,
            "hazard_type": hazard_type,
            "labels": labels,
            "person_detected": person_detected,
            "detections": detections,
        }

    except Exception:
        return {
            "hazard": False,
            "hazard_type": None,
            "labels": "scan unavailable",
            "person_detected": False,
            "detections": [],
        }
