"""
scan.py — POST /scan

Lightweight continuous scan endpoint. Runs YOLO for object detection
+ conditional face recognition (only when a person is detected).

Returns short spatial labels instead of verbose Gemini narrations.
Full scene analysis is handled by the existing /scene endpoint
on explicit user request.
"""

from fastapi import APIRouter
from models.schemas import ScanRequest, ScanResponse, FaceResult, FacePosition
from services import scan_service

router = APIRouter(prefix="/scan", tags=["scan"])


@router.post("", response_model=ScanResponse)
def scan_frame(req: ScanRequest):
    """
    Unified lightweight scan endpoint.

    - Runs YOLO for object detection → short spatial labels
    - If person detected → runs face recognition automatically
    - Returns labels, hazard info, and face results in one response
    """
    result = scan_service.unified_scan(req.frame)

    # Convert face dicts to FaceResult models
    face_models = []
    for f in result.get("faces", []):
        face_models.append(FaceResult(
            name=f.get("name"),
            emotion=None,  # emotion only on full analysis
            position=FacePosition(**f["position"]),
            known=f["known"],
            encoding_hash=f.get("encoding_hash"),
            should_announce=f.get("should_announce", False),
        ))

    return ScanResponse(
        labels=result["labels"],
        hazard=result["hazard"],
        hazard_type=result["hazard_type"],
        person_detected=result["person_detected"],
        faces=face_models,
    )
