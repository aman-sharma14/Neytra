"""
enroll.py — POST /enroll

Add a new face to the recognition database.
Accepts a single-face frame + name.
Member A owns this file.
"""

from fastapi import APIRouter
from models.schemas import EnrollRequest, EnrollResponse
from services import face_service

router = APIRouter(prefix="/enroll", tags=["enroll"])


@router.post("", response_model=EnrollResponse)
def enroll_face(req: EnrollRequest):
    """
    Enroll a new face into the recognition database.
    The frame must contain exactly one face.
    """
    success, message = face_service.enroll_face(req.frame, req.name)
    return EnrollResponse(success=success, message=message)
