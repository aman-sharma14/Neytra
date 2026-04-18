"""
command.py — POST /command

Intent parser for voice commands. Keyword matching is tried first
(fast, no API call). Falls back to Gemini for ambiguous input.
Member A owns this file.
"""

import re
from fastapi import APIRouter
from models.schemas import CommandRequest, CommandResponse
from services import gemini_service, memory_service

router = APIRouter(prefix="/command", tags=["command"])

# ── Keyword patterns ─────────────────────────────────────────────────────────

_PATTERNS = {
    "scene_describe": re.compile(
        r"\b(what('s| is) (around|near|in front of) me|describe|scene|surroundings|analy[sz]e|full scan|look around)\b",
        re.IGNORECASE
    ),
    "ahead": re.compile(
        r"\bwhat('s| is) ahead\b",
        re.IGNORECASE
    ),
    "navigate": re.compile(
        r"\btake me to\b|\bgo to\b|\bnavigate to\b|\bdirections? to\b",
        re.IGNORECASE
    ),
    "remember": re.compile(
        r"\bremember this as\b|\bsave this as\b|\bmark this as\b",
        re.IGNORECASE
    ),
    "face_identify": re.compile(
        r"\bwho is (this|that|here|near me)\b|\bidentify (this|that) person\b",
        re.IGNORECASE
    ),
    "stop": re.compile(
        r"\b(stop|pause|quiet|silence|shut up)\b",
        re.IGNORECASE
    ),
    "enroll_face": re.compile(
        r"\b(store|save|remember|add|enroll) (this |the )?(face|person) as\s+\S+",
        re.IGNORECASE
    ),
}


def _extract_location(text: str) -> str | None:
    """Extract the place name after 'take me to'/'go to' etc."""
    match = re.search(
        r"\b(?:take me to|go to|navigate to|directions? to)\s+(.+)",
        text, re.IGNORECASE
    )
    return match.group(1).strip() if match else None


def _extract_remember_name(text: str) -> str | None:
    """Extract the name to save after 'remember this as'."""
    match = re.search(
        r"\b(?:remember|save|mark) this as\s+(.+)",
        text, re.IGNORECASE
    )
    return match.group(1).strip() if match else None


def _to_location_id(name: str) -> str:
    """Convert 'College Canteen' → 'college_canteen'."""
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


@router.post("", response_model=CommandResponse)
async def handle_command(req: CommandRequest):
    """
    Parses a voice command and returns the action + response text.

    Action values:
      scene_describe — describe current scene
      navigate       — load memory and start navigation
      remember       — save current location waypoint
      face_identify  — trigger face recognition
      stop           — stop all narration
      unknown        — could not parse
    """
    text = req.text.strip()

    # ── Keyword matching ──────────────────────────────────────────────────────
    if _PATTERNS["stop"].search(text):
        return CommandResponse(action="stop", response="Narration paused.")

    if _PATTERNS["face_identify"].search(text):
        return CommandResponse(
            action="face_identify",
            response="Scanning for known faces."
        )

    if _PATTERNS["remember"].search(text):
        name = _extract_remember_name(text) or "unnamed location"
        location_id = _to_location_id(name)
        return CommandResponse(
            action="remember",
            response=f"Saving this location as {name}. Say 'add step' to add waypoints."
        )

    if _PATTERNS["navigate"].search(text):
        location_name = _extract_location(text) or text
        location_id = _to_location_id(location_name)
        memory = memory_service.get_waypoints(location_id)
        if memory:
            return CommandResponse(
                action="navigate",
                response=f"Memory loaded for {location_name}. Starting navigation."
            )
        else:
            return CommandResponse(
                action="navigate",
                response=f"No saved memory for {location_name}. Walk me there first and say remember this as {location_name}."
            )

    if _PATTERNS["ahead"].search(text):
        return CommandResponse(
            action="scene_describe",
            response="Describing what is directly ahead."
        )

    if _PATTERNS["scene_describe"].search(text):
        return CommandResponse(
            action="scene_describe",
            response="Describing your surroundings."
        )

    if _PATTERNS["enroll_face"].search(text):
        match = re.search(r"\bas\s+(.+)$", text, re.IGNORECASE)
        name = match.group(1).strip() if match else "Unknown"
        return CommandResponse(action="enroll", response=name)

    # ── Gemini/NIM fallback ────────────────────────────────────────────────────────
    intent = await gemini_service.parse_command_intent(text, req.frame, use_nim=req.use_nim)
    action = intent.get("action", "unknown")

    if action == "navigate":
        loc = intent.get("location") or "unknown location"
        return CommandResponse(
            action="navigate",
            response=f"Understood. Taking you to {loc}."
        )
    if action == "remember":
        name = intent.get("remember_as") or "this location"
        return CommandResponse(
            action="remember",
            response=f"Saving as {name}."
        )
    if action == "scene_describe":
        return CommandResponse(
            action="scene_describe",
            response="Describing your surroundings."
        )
    if action == "enroll_face":
        name = intent.get("enroll_as") or "Unknown"
        return CommandResponse(
            action="enroll",
            response=name
        )

    return CommandResponse(
        action="unknown",
        response="Sorry, I didn't understand that. Try: 'What's around me?', 'Take me to X', or 'Remember this as Y'."
    )
