"""
scene.py — POST /scene

Accepts a camera frame, runs YOLO for hazard detection,
then sends the frame to Gemini for accessibility narration.
Member A owns this file.
"""

from fastapi import APIRouter
from models.schemas import SceneRequest, SceneResponse
from services import yolo_service, gemini_service, memory_service

router = APIRouter(prefix="/scene", tags=["scene"])


@router.post("", response_model=SceneResponse)
async def describe_scene(req: SceneRequest):
    """
    Primary narration endpoint.
    - Runs YOLO first (fast, local) to flag hazards
    - Then sends frame to Gemini for natural language narration
    - If location_id provided, memory is used to guide navigation narration
    """
    print("Received /scene request")
    
    # Step 1: Hazard detection (synchronous, fast)
    print("Running YOLO...")
    try:
        hazard, hazard_type = yolo_service.detect_hazards(req.frame)
        print(f"YOLO complete: hazard={hazard}, type={hazard_type}")
    except Exception as e:
        print("YOLO crashed:", e)
        hazard, hazard_type = False, None

    # Step 2: Generate narration
    print(f"Running LLM... (location_id={req.location_id}, use_nim={req.use_nim})")
    try:
        if req.location_id:
            memory = memory_service.get_waypoints(req.location_id)
            if memory:
                narration = await gemini_service.navigate_with_memory(
                    req.frame, req.location_id, memory, use_nim=req.use_nim
                )
            else:
                narration = await gemini_service.describe_scene(req.frame, use_nim=req.use_nim)
        else:
            narration = await gemini_service.describe_scene(req.frame, use_nim=req.use_nim)
        print("Gemini complete.")
    except Exception as e:
        print("Gemini crashed:", e)
        narration = str(e)

    print("Returning response.")
    return SceneResponse(
        narration=narration,
        hazard=hazard,
        hazard_type=hazard_type,
    )
