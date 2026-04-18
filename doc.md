# Neytra Extended — Full Technical Build Document
### AI-Powered Spatial Companion for the Visually Impaired
> Hackathon Build Guide | 8–9 Hour MVP

---

## 1. What Are We Building

A web-based accessibility companion that turns any camera (laptop or mobile) into an intelligent eye. It narrates the environment, recognises known faces, learns indoor spaces over time, and guides the user conversationally — without GPS, without floor plans, and without any prior knowledge of the building.

The product has four pillars:

- **Live Scene Narration** — continuous ambient awareness of what's ahead
- **Conversational Navigation** — talk to it, it guides you
- **Spatial Memory** — it remembers places you've walked before, by name
- **Face Recognition** — identifies known people; quietly learns new ones

---

## 2. Does This Fit the Theme?

Yes. Under PS4 Open Innovation — "accessibility" and "physical safety and independence" are explicitly within scope. Frame it as:

> *Physical safety and autonomous mobility as a form of daily wellbeing. Independence is health.*

---

## 3. Tech Stack

### Backend (Python — extend what Neytra already has)

| Layer | Technology | Why |
|---|---|---|
| Web framework | FastAPI (already used) | Keep it, add new endpoints |
| Vision / scene | Google Gemini 2.5 Flash API | Multimodal, fast, already integrated |
| Face detection | face_recognition + OpenCV (already used) | Keep exactly as is |
| Object detection | YOLOv8 (already used) | Keep for hazard detection |
| Emotion detection | DeepFace (`pip install deepface`) | Lightweight, works on face crops |
| Spatial memory store | JSON file per location (simple dict) | No DB needed for MVP |
| Speech output | Edge TTS (`pip install edge-tts`) or browser Web Speech API | Natural sounding voice |

### Frontend (New — this is what judges see first)

| Layer | Technology | Why |
|---|---|---|
| Framework | React (Vite) | Fast setup, component-based |
| Styling | Tailwind CSS | Rapid UI |
| Camera access | MediaDevices API (`getUserMedia`) | Browser native |
| Voice input | Web Speech API (already in Neytra) | No library needed |
| Voice output | Web Speech API `speechSynthesis` | Browser native |
| Animations | Framer Motion | Smooth, impressive micro-interactions |
| Icons | Lucide React | Clean |

> **Note:** Keep the existing vanilla JS mobile client if it works. Build the new React UI as a separate entry point for the demo/judges. Polish matters here.

---

## 4. System Architecture

```
Browser (React UI)
    │
    ├── Camera feed (MediaDevices API)
    │       └── Frame captured every 2-3s → sent to backend as base64
    │
    ├── Voice input (Web Speech API)
    │       └── User command → POST /command
    │
    └── Voice output (speechSynthesis)
            └── Reads backend responses aloud

FastAPI Backend
    │
    ├── POST /scene        ← frame → Gemini → narration text
    ├── POST /face         ← frame → YOLO + face_recognition → names / unknowns
    ├── POST /emotion      ← face crop → DeepFace → emotion label
    ├── POST /command      ← voice text → intent parser → routed action
    ├── POST /remember     ← save spatial waypoint to memory file
    └── GET  /recall/:id   ← load memory for a named location

Spatial Memory (JSON)
    location_id (slug) → [
        { step: 1, description: "Glass door ahead", landmark: true },
        { step: 2, description: "Staircase left after 10 steps" },
        ...
    ]

Face Database (existing .pkl)
    encoding → name mapping (unchanged from Neytra)
```

---

## 5. Feature Breakdown — What to Build & How

### 5.1 Live Scene Narration

**What it does:** Every 2–3 seconds, captures a frame and sends to Gemini with a prompt optimised for visually impaired users. Output is spoken aloud.

**Gemini prompt:**
```
You are assisting a visually impaired person. Describe what is directly ahead in 1-2 short sentences. 
Prioritise: obstacles, hazards, stairs, doors, people, wet floor signs. 
Do NOT describe background details unless safety-relevant. 
Be direct. Use compass directions (left, right, ahead) not visual metaphors.
If nothing notable: say "Path clear ahead."
```

**Frequency logic:**
- Default: every 3 seconds, lightweight check
- If hazard detected (YOLO sees stairs/person/vehicle in center zone): immediate interrupt, speak before next cycle
- If user is in conversation: pause narration, resume after

**Backend endpoint:** `POST /scene` — accepts `{ frame: base64string }`, returns `{ narration: string, hazard: bool }`

---

### 5.2 Conversational Navigation + Spatial Memory

**How memory works:**

On first visit, user says: *"Remember this as college canteen entrance."*

Backend stores a waypoint:
```json
{
  "college_canteen_entrance": {
    "created": "2024-01-01T10:00:00",
    "waypoints": [
      { "step": 1, "description": "Glass double door, push right side" },
      { "step": 2, "description": "Corridor ahead, vending machine on right" },
      { "step": 3, "description": "Left turn at blue wall, canteen door" }
    ]
  }
}
```

Waypoints are added as the user walks — each narration step that the user confirms gets appended.

On second visit, user says: *"Take me to the canteen."*

Backend loads the memory + current frame → Gemini prompt:
```
The user wants to reach "college canteen entrance".
Here is what this route looked like last time they walked it:
[memory JSON]
Here is what the camera sees right now:
[current frame description]
Cross-reference the two and give the next navigation instruction. 
If you can match a landmark from memory to the current view, say so.
If not, ask the user to describe where they are.
```

**Voice commands to handle:**
- `"What's around me?"` → full scene description
- `"Take me to [place]"` → load memory, start guidance
- `"Remember this as [name]"` → save current waypoint
- `"Who is this?"` → trigger face recognition on current frame
- `"What's ahead?"` → focused forward narration
- `"Stop"` → pause all narration

**Intent parser:** Simple keyword matching is enough for MVP. No need for a separate NLP model — Gemini can parse intent if you pass it the raw voice text.

---

### 5.3 Face Recognition (Existing Neytra — Keep As-Is + Timer Logic)

**Timer-gating logic (new addition):**

```python
face_timers = {}  # face_id -> first_seen_timestamp
ANNOUNCE_THRESHOLD = 3    # seconds to announce known face
ENROLL_THRESHOLD = 8      # seconds to prompt enrollment for unknown

def process_faces(detected_faces):
    now = time.time()
    announcements = []
    
    for face in detected_faces:
        face_id = face['encoding_hash']  # hash of encoding as ID
        
        if face_id not in face_timers:
            face_timers[face_id] = now
            continue
        
        elapsed = now - face_timers[face_id]
        
        if face['known'] and elapsed >= ANNOUNCE_THRESHOLD:
            announcements.append(('known', face['name']))
            face_timers.pop(face_id)  # reset after announcing
            
        elif not face['known'] and elapsed >= ENROLL_THRESHOLD:
            announcements.append(('unknown', None))
            face_timers.pop(face_id)
    
    # Queue: known faces first, then unknowns
    return sorted(announcements, key=lambda x: 0 if x[0]=='known' else 1)
```

**Multiple faces:** Queue announcements sequentially. Speak with 600ms gap between each. Never speak simultaneously.

---

### 5.4 Emotion Detection (Small but Impressive)

**Library:** DeepFace — `pip install deepface`

**What it does:** When a known face is recognised, also detect their emotion and include it in the announcement.

Instead of: *"Rahul is on your left."*
Say: *"Rahul is on your left — he looks happy."*

**Implementation:**
```python
from deepface import DeepFace

def get_emotion(face_crop_image):
    try:
        result = DeepFace.analyze(face_crop_image, actions=['emotion'], enforce_detection=False)
        dominant = result[0]['dominant_emotion']
        # Map to natural language
        emotion_map = {
            'happy': 'looks happy',
            'sad': 'seems a bit down',
            'angry': 'seems tense',
            'surprise': 'looks surprised',
            'neutral': '',  # don't say anything for neutral
            'fear': 'seems anxious',
            'disgust': 'seems uncomfortable'
        }
        return emotion_map.get(dominant, '')
    except:
        return ''
```

Only run DeepFace when a face clears the 3-second timer — not on every frame. Skip emotion output if neutral (it sounds weird to say "Rahul looks neutral").

---

## 6. UI/UX — What to Show on Screen

Judges will see the screen. This is your first impression. Here's exactly what to build.

### Design Direction: Dark, Accessible, Cinematic

Think: a high-end assistive device, not a health app. Dark background (`#0a0a0f`), electric blue accents (`#3b82f6`), clean sans-serif, large text, smooth pulse animations.

The philosophy: **the UI is for the demo, not the user.** The real user experiences it through audio. But judges need to see what's happening.

---

### Screen Layout (Single Page, Three Zones)

```
┌─────────────────────────────────────────┐
│  NEYTRA          [●] LIVE    [MIC ON]   │  ← Header / status bar
├─────────────────────────────────────────┤
│                                         │
│         [ CAMERA FEED ]                 │  ← Live video, takes 60% height
│                                         │
│  ┌──────────────────────────────────┐   │
│  │ 🔵 Staircase detected on left   │   │  ← Hazard alert overlay (animated)
│  └──────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  NARRATION                              │  ← Current spoken output (large text)
│  "Path clear ahead. Door on right."     │
│                                         │
│  LAST HEARD                             │  ← What user said (voice input echo)
│  "Take me to the canteen"               │
├─────────────────────────────────────────┤
│  [FACE PANEL]    [MEMORY]   [SETTINGS]  │  ← Bottom tabs (optional)
└─────────────────────────────────────────┘
```

### Component Details

**Status Bar:**
- Pulsing green dot when narration is active
- Microphone icon that glows when listening
- Location memory indicator: *"📍 Memory: College loaded"*

**Camera Feed:**
- Live `<video>` element
- Overlay bounding boxes for detected faces (draw on `<canvas>` layered on top)
- Bounding box color: green = known, yellow = unknown
- Name label above each box
- Emotion label in smaller text below name: `Rahul 😊 happy`

**Hazard Alert:**
- Appears as an animated banner when YOLO detects a priority hazard
- Slides up from bottom of video with a pulse
- Color: amber for caution, red for stop-level hazard
- Auto-dismisses after 4 seconds or next narration cycle

**Narration Panel:**
- Large text (20px+), high contrast
- Animates in word by word (typewriter effect) as speech plays
- Previous narration fades to 50% opacity below current

**Voice Command Echo:**
- Shows what the system heard
- Confirms back: *"Understood: Taking you to canteen"*

**Memory Panel (tab):**
- List of saved locations with timestamps
- Tap to load (or say the name)
- Simple: name + date saved + number of waypoints

---

## 7. API Endpoints — Full List

| Method | Endpoint | Input | Output |
|---|---|---|---|
| POST | `/scene` | `{ frame: base64 }` | `{ narration: str, hazard: bool, hazard_type: str }` |
| POST | `/face` | `{ frame: base64 }` | `{ faces: [{ name, emotion, position, known }] }` |
| POST | `/command` | `{ text: str, frame: base64 }` | `{ action: str, response: str }` |
| POST | `/memory/save` | `{ location_id: str, description: str, landmark: bool }` | `{ success: bool }` |
| GET | `/memory/:id` | — | `{ waypoints: [...] }` |
| GET | `/memory` | — | `{ locations: [id, name, count] }` |
| POST | `/enroll` | `{ frame: base64, name: str }` | `{ success: bool }` |

---

## 8. Build Order (Time-Boxed)

### Hour 1–2: Backend Foundation
- Add `/scene`, `/face`, `/command` endpoints to existing FastAPI
- Wire Gemini prompt for scene narration
- Add timer logic to face pipeline
- Install and test DeepFace on a sample image

### Hour 3–4: Frontend Shell
- Vite + React + Tailwind setup
- Camera feed component (`getUserMedia`)
- Voice input (Web Speech API)
- Voice output (`speechSynthesis`)
- Basic layout: video + narration panel

### Hour 5–6: Connect Frontend to Backend
- Frame capture loop (every 2-3s → `/scene`)
- Face results → draw bounding boxes on canvas overlay
- Voice command → `/command` → speak response
- Hazard alert component

### Hour 7: Spatial Memory
- `/memory/save` and `/memory/:id` endpoints
- Memory panel UI (list of saved locations)
- "Remember this as X" voice command → save
- "Take me to X" → load + feed to Gemini for guidance

### Hour 8: Polish + Demo Prep
- Emotion labels on face bounding boxes
- Typewriter animation on narration text
- Hazard alert animation
- Test full flow: walk through, save memory, recall it
- Prepare demo script (see below)

### Hour 9 (Buffer): Fix what broke
- Always keep this free

---

## 9. Demo Script for Judges

**Setup:** Laptop camera running. One team member standing in frame. A named location pre-saved ("college library entrance").

**Flow:**

1. Open app. Camera activates. Narration starts: *"Path clear. Person ahead."*
2. Known face recognized: *"Rahul is ahead — he looks happy."*
3. Judge asks: what if face is unknown? → Unknown person stands in frame for 8 seconds → *"Unknown person. Would you like to remember them?"* → Voice enroll.
4. Say: *"What's around me?"* → Full scene description spoken + shown.
5. Say: *"Take me to the college library."* → Memory loads → Gemini cross-references current frame with saved waypoints → Step-by-step guidance begins.
6. Show memory panel — saved locations, waypoints, timestamps.

**Closing line for pitch:**
> *"Every other app tells you what happened. Neytra tells you where to go next — and remembers so you don't have to."*

---

## 10. Small but Impressive Details

| Feature | Effort | Impact |
|---|---|---|
| Emotion on face labels | 1 hour | High — humanizes the product |
| Hazard pulse animation | 30 min | High — shows real-time intelligence |
| Typewriter narration text | 20 min | Medium — feels alive |
| Voice command echo ("I heard: ...") | 20 min | Medium — builds trust |
| Memory panel with waypoint count | 30 min | High — makes the differentiator visible |
| Bounding box color: green/yellow | 20 min | High — instant visual clarity |
| "Path clear" spoken softly vs hazard spoken urgently (TTS rate/pitch) | 15 min | High — accessibility polish |

---

## 11. What Not to Build

- Real-time GPS tracking (use declaration instead)
- OCR / text reading (separate feature, different demo)
- Backend auth / user accounts
- Mobile app (web browser on phone is enough)
- Custom ML models (use existing APIs)

---

## 12. Honest Limitations to Acknowledge

Judges respect honesty. Frame these as roadmap, not failure:

- Indoor memory works best in stable environments (furniture doesn't move)
- Emotion detection accuracy depends on lighting and face angle
- Spatial recall is probabilistic, not precise — the AI guides, not navigates
- Real-world deployment would use smart glasses with always-on camera, not a laptop

> *"The MVP proves the concept. The hardware makes it wearable."*
