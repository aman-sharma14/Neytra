"""
memory_service.py — JSON-based spatial memory store.

Each location gets its own JSON file: MEMORY_DIR/{location_id}.json
Format:
  {
    "location_id": "college_canteen_entrance",
    "display_name": "College Canteen Entrance",
    "created": "ISO timestamp",
    "waypoints": [
      { "step": 1, "description": "...", "landmark": true, "timestamp": "..." }
    ]
  }

No database required for MVP. Files are written atomically (write to tmp, rename).
"""

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from config import MEMORY_DIR


def _location_path(location_id: str) -> Path:
    """Return the path to a location's JSON file."""
    # Sanitise: only allow safe characters
    safe_id = "".join(c if c.isalnum() or c in "_-" else "_" for c in location_id.lower())
    return MEMORY_DIR / f"{safe_id}.json"


def _load_location(location_id: str) -> dict | None:
    path = _location_path(location_id)
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_location(data: dict) -> None:
    path = _location_path(data["location_id"])
    tmp_path = path.with_suffix(".tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp_path, path)   # atomic rename


def _to_display_name(location_id: str) -> str:
    return location_id.replace("_", " ").replace("-", " ").title()


def save_waypoint(location_id: str, description: str, landmark: bool) -> dict:
    """
    Append a waypoint to the named location. Creates the location if it doesn't exist.

    Returns { success: bool, waypoint_count: int }
    """
    existing = _load_location(location_id)
    now_iso = datetime.now(timezone.utc).isoformat()

    if existing is None:
        existing = {
            "location_id": location_id,
            "display_name": _to_display_name(location_id),
            "created": now_iso,
            "waypoints": [],
        }

    next_step = len(existing["waypoints"]) + 1
    existing["waypoints"].append({
        "step": next_step,
        "description": description,
        "landmark": landmark,
        "timestamp": now_iso,
    })

    _save_location(existing)
    return {"success": True, "waypoint_count": len(existing["waypoints"])}


def get_waypoints(location_id: str) -> dict | None:
    """
    Load and return the full memory for a location.
    Returns None if not found.
    """
    return _load_location(location_id)


def list_locations() -> list[dict]:
    """
    Return a summary list of all saved locations:
      [{ location_id, display_name, waypoint_count, created }]
    """
    locations = []
    for path in sorted(MEMORY_DIR.glob("*.json")):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            locations.append({
                "location_id": data["location_id"],
                "display_name": data.get("display_name", _to_display_name(data["location_id"])),
                "waypoint_count": len(data.get("waypoints", [])),
                "created": data.get("created", ""),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return locations


def delete_location(location_id: str) -> bool:
    """Remove a location file. Returns True if deleted, False if not found."""
    path = _location_path(location_id)
    if path.exists():
        path.unlink()
        return True
    return False
