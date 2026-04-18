"""
face.py — POST /face

Runs face recognition with timer logic, then runs DeepFace emotion
detection on faces that cleared the announce threshold.
Member A owns this file.
"""

from fastapi import APIRouter
from models.schemas import FaceRequest, FaceResponse, FaceResult, FacePosition
from services import face_service, emotion_service

router = APIRouter(prefix="/face", tags=["face"])


@router.post("", response_model=FaceResponse)
def detect_faces(req: FaceRequest):
    """
    Face recognition endpoint.
    Only returns faces that have cleared their announce timer (3s known / 8s unknown).
    Each result includes:
      - name (known) or None (unknown)
      - emotion phrase (e.g. "looks happy") or None
      - bounding box position
      - known flag
    """
    raw_results = face_service.process_frame(req.frame)

    face_results: list[FaceResult] = []
    for r in raw_results:
        # Only include faces that the timer has cleared
        if not (r["should_announce"] or r["should_enroll_prompt"]):
            # Still return position info for UI bounding boxes (no announcement)
            face_results.append(FaceResult(
                name=r["name"],
                emotion=None,
                position=FacePosition(**r["position"]),
                known=r["known"],
                encoding_hash=r["encoding_hash"],
                should_announce=False,
            ))
            continue

        # Run emotion only on faces being announced
        emotion_str: str | None = None
        if r["known"] and r["should_announce"] and r["face_crop"] is not None:
            emotion_raw = emotion_service.get_emotion(r["face_crop"])
            emotion_str = emotion_raw if emotion_raw else None

        face_results.append(FaceResult(
            name=r["name"],
            emotion=emotion_str,
            position=FacePosition(**r["position"]),
            known=r["known"],
            encoding_hash=r["encoding_hash"],
            should_announce=r["should_announce"],
        ))

    return FaceResponse(faces=face_results)
