"""
memory.py — Spatial memory endpoints

POST /memory/save  — append a waypoint to a named location
GET  /memory/{id}  — fetch all waypoints for a location
GET  /memory       — list all saved locations
Member A owns this file.
"""

from fastapi import APIRouter, HTTPException
from models.schemas import (
    WaypointSaveRequest, WaypointSaveResponse,
    MemoryGetResponse, MemoryListResponse,
    Waypoint, LocationSummary,
)
from services import memory_service

router = APIRouter(prefix="/memory", tags=["memory"])


@router.post("/save", response_model=WaypointSaveResponse)
def save_waypoint(req: WaypointSaveRequest):
    """Append a waypoint to the named location's memory file."""
    result = memory_service.save_waypoint(
        location_id=req.location_id,
        description=req.description,
        landmark=req.landmark,
    )
    return WaypointSaveResponse(**result)


@router.get("", response_model=MemoryListResponse)
def list_locations():
    """Return a summary list of all saved spatial memories."""
    locs = memory_service.list_locations()
    return MemoryListResponse(
        locations=[LocationSummary(**loc) for loc in locs]
    )


@router.get("/{location_id}", response_model=MemoryGetResponse)
def get_memory(location_id: str):
    """Fetch the full waypoint list for a named location."""
    data = memory_service.get_waypoints(location_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Location '{location_id}' not found.")
    return MemoryGetResponse(
        location_id=data["location_id"],
        created=data["created"],
        waypoints=[Waypoint(**w) for w in data["waypoints"]],
    )
