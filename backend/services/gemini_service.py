"""
gemini_service.py — All interactions with the Gemini 2.5 Flash API.

Three distinct prompts:
  1. describe_scene()       — ambient narration for a visually impaired user
  2. navigate_with_memory() — cross-reference memory waypoints with current frame
  3. parse_command()        — intent extraction fallback when keyword match fails
"""

import urllib.request
import json
import base64
import asyncio
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from config import GEMINI_API_KEY, NVIDIA_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

_model = genai.GenerativeModel("gemini-2.5-flash")

_SAFETY = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}

# ── Prompts ────────────────────────────────────────────────────────────────────

_SCENE_PROMPT = (
    "You are a real-time audio guide for a blind person. "
    "Rules: MAX 15 words. One sentence only. No full stops mid-sentence. "
    "Mention ONLY: obstacles, people, stairs, doors, vehicles, floor hazards. "
    "Use spatial words: left, right, ahead, behind. Never use visual metaphors. "
    "If the scene is safe and clear, reply ONLY: \"Path clear ahead\" "
    "If the scene is similar to what you last described, reply ONLY: \"No change\" "
    "NEVER describe colors, lighting, decorations, or background details."
)

_HAZARD_TYPES = ["stairs", "step", "wet floor", "vehicle", "bicycle", "construction"]

def _frame_to_part(base64_frame: str) -> dict:
    """Convert a base64 JPEG string to a Gemini inline_data part."""
    return {
        "inline_data": {
            "mime_type": "image/jpeg",
            "data": base64_frame,
        }
    }

def _build_nim_payload(prompt: str, base64_frame: str = None) -> dict:
    if base64_frame:
        content = [
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_frame}"}},
            {"type": "text", "text": prompt}
        ]
    else:
        content = [{"type": "text", "text": prompt}]
    
    return {
        "model": "meta/llama-3.2-11b-vision-instruct",
        "messages": [{"role": "user", "content": content}],
        "max_tokens": 80,
        "stream": False
    }

async def _call_nim(payload: dict) -> str:
    def _do_req():
        req = urllib.request.Request(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode("utf-8"))
                return result["choices"][0]["message"]["content"].strip()
        except urllib.error.HTTPError as e:
            return f"NIM API Error: {e.code} {e.reason} - {e.read().decode('utf-8')}"
        except Exception as e:
            return f"NIM Connection Error: {str(e)}"
    
    return await asyncio.to_thread(_do_req)

async def describe_scene(base64_frame: str, use_nim: bool = False) -> str:
    """
    Send a camera frame to Gemini or NIM and return a short accessibility narration.
    """
    if use_nim:
        return await _call_nim(_build_nim_payload(_SCENE_PROMPT, base64_frame))
        
    try:
        response = await asyncio.to_thread(
            lambda: _model.generate_content(
                [_SCENE_PROMPT, _frame_to_part(base64_frame)],
                safety_settings=_SAFETY
            )
        )
        return response.text.strip()
    except Exception as exc:
        return f"Scene description unavailable. Error: {str(exc)[:80]}"


async def navigate_with_memory(base64_frame: str, location_id: str, memory: dict, use_nim: bool = False) -> str:
    """
    Given a named location's saved waypoints and the current camera frame,
    ask Gemini/NIM to produce the *next* navigation instruction.
    """
    memory_json = json.dumps(memory, indent=2)
    prompt = (
        f'The user wants to reach "{location_id.replace("_", " ")}".\n'
        f"Here is what this route looked like last time they walked it:\n{memory_json}\n\n"
        "Here is what the camera sees right now:\n[image attached]\n\n"
        "Cross-reference the two and give the NEXT navigation instruction in one sentence. "
        "If you can match a landmark from memory to the current view, say so explicitly. "
        "If the view does not match any waypoint, ask the user to describe where they are."
    )
    if use_nim:
        return await _call_nim(_build_nim_payload(prompt, base64_frame))
        
    try:
        response = await asyncio.to_thread(
            lambda: _model.generate_content(
                [prompt, _frame_to_part(base64_frame)],
                safety_settings=_SAFETY
            )
        )
        return response.text.strip()
    except Exception as exc:
        return f"Navigation unavailable. Error: {str(exc)[:80]}"


async def parse_command_intent(text: str, base64_frame: str | None = None, use_nim: bool = False) -> dict:
    """
    Fallback intent parser using Gemini or NIM.
    """
    prompt = (
        "You are an intent classifier for a voice assistant for the visually impaired.\n"
        f'User said: "{text}"\n\n'
        'Return ONLY a JSON object with these keys:\n'
        '  "action": one of ["scene_describe","navigate","remember","face_identify","stop","enroll_face","unknown"]\n'
        '  "location": the place name if action is navigate (else null)\n'
        '  "remember_as": the name to save if action is remember (else null)\n'
        '  "enroll_as": the name of the person if action is enroll_face (else null)\n'
        "No explanation, no markdown, just the JSON."
    )
    
    if use_nim:
        raw = await _call_nim(_build_nim_payload(prompt, base64_frame))
        try:
            cleaned = raw.strip().strip("```json").strip("```").strip()
            return json.loads(cleaned)
        except:
            return {"action": "unknown", "location": None, "remember_as": None}

    parts = [prompt]
    if base64_frame:
        parts.append(_frame_to_part(base64_frame))
    try:
        response = await asyncio.to_thread(
            lambda: _model.generate_content(
                parts,
                safety_settings=_SAFETY
            )
        )
        raw = response.text.strip().strip("```json").strip("```").strip()
        return json.loads(raw)
    except Exception:
        return {"action": "unknown", "location": None, "remember_as": None}
