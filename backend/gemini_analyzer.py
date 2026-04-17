"""
OpenAI GPT-4o vision analyzer for Lance.

Sends a JPEG frame to GPT-4o and returns a structured personal wellness analysis.
"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Optional

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
MODEL_NAME = "gpt-4o"

WELLNESS_PROMPT = """You are a personal wellness monitor watching someone at their desk via webcam. Analyze this image carefully and return ONLY a raw JSON object — no markdown, no code fences, no explanation.

Detect and assess the following wellness indicators:

POSTURE: Analyze the person's sitting position. Look for forward head posture, slouching, rounded shoulders, neck tilt, twisted spine, or leaning to one side.

EYE_STRAIN: Look for signs of eye strain — squinting, eyes very close to screen, rubbing eyes, eyes visibly red or squinting hard, or face extremely close to camera.

HYDRATION: Look for any water bottle, glass of water, or drink within reach of the person. Note if a hydration item is visible or absent.

FOCUS_STATE: Assess if the person appears alert and focused, drowsy (eyes drooping, head nodding, cheek resting on hand), or distracted.

PRESENCE: Detect if a person is visible at all. If the seat is empty note it.

ENVIRONMENT: Note obvious environmental issues — very poor lighting, screen glare, monitor too high or too low relative to eye level.

SCREEN_PROXIMITY: Estimate how close the person's face is to the screen based on the apparent size of the face relative to the frame. A face that takes up more than 40 percent of the frame height is too close. Classify as 'safe', 'close', or 'too_close'.

EYE_OPENNESS: Analyze how open the eyes are as an indicator of eye soreness or fatigue. Look at the eye aperture — how much of the iris and white of the eye is visible. A fully alert person has wide open eyes. Soreness or fatigue causes partial closure, squinting, or frequent blinking posture. Rate as 'normal', 'partially_closed', or 'squinting'. Also estimate an openness percentage from 0 to 100 where 100 is fully open and 0 is fully closed.

Return exactly this JSON structure and nothing else:
{
  "presence": true,
  "posture": {
    "score": 75,
    "status": "good",
    "issues": [],
    "description": "Upright seated position with good alignment"
  },
  "eye_strain": {
    "detected": false,
    "severity": "none",
    "description": "Eyes appear relaxed and normal distance from screen"
  },
  "hydration": {
    "water_visible": true,
    "container_type": "water bottle",
    "description": "Water bottle visible on desk"
  },
  "focus_state": {
    "state": "focused",
    "confidence": 0.9,
    "description": "Alert and engaged with screen"
  },
  "environment": {
    "lighting": "good",
    "monitor_position": "good",
    "issues": []
  },
  "screen_proximity": {
    "status": "safe",
    "estimated_distance": "normal",
    "face_fill_ratio": 0.28,
    "description": "Good viewing distance maintained"
  },
  "eye_openness": {
    "status": "normal",
    "openness_percent": 88,
    "sore_eyes_likely": false,
    "description": "Eyes wide open and alert"
  },
  "overall_wellness": "good",
  "frame_summary": "Person is sitting well with water nearby and appears focused"
}

Field constraints:
  posture.status: exactly "good" | "warning" | "poor"
  posture.score: integer 0-100
  eye_strain.severity: exactly "none" | "mild" | "severe"
  hydration.container_type: exactly "water bottle" | "glass" | "cup" | "none"
  focus_state.state: exactly "focused" | "drowsy" | "distracted" | "away"
  environment.lighting: exactly "good" | "poor" | "glare"
  environment.monitor_position: exactly "good" | "too_high" | "too_low" | "unknown"
  screen_proximity.status: exactly "safe" | "close" | "too_close"
  screen_proximity.estimated_distance: exactly "normal" | "slightly_close" | "very_close"
  eye_openness.status: exactly "normal" | "partially_closed" | "squinting"
  eye_openness.openness_percent: integer 0-100
  overall_wellness: exactly "good" | "fair" | "poor"

If no person is visible set presence to false and return neutral/unknown values for all other fields."""

_DEFAULT_RESULT = {
    "presence": False,
    "posture": {"score": 50, "status": "good", "issues": [], "description": "No data"},
    "eye_strain": {"detected": False, "severity": "none", "description": "No data"},
    "hydration": {"water_visible": False, "container_type": "none", "description": "No data"},
    "focus_state": {"state": "away", "confidence": 0.0, "description": "No data"},
    "environment": {"lighting": "good", "monitor_position": "unknown", "issues": []},
    "screen_proximity": {"status": "safe", "estimated_distance": "normal", "face_fill_ratio": 0.3, "description": "No data"},
    "eye_openness": {"status": "normal", "openness_percent": 80, "sore_eyes_likely": False, "description": "No data"},
    "overall_wellness": "good",
    "frame_summary": "Analysis unavailable",
}

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        if not OPENAI_API_KEY:
            raise EnvironmentError(
                "OPENAI_API_KEY is not set. Add it to your .env file."
            )
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def analyze_frame(jpeg_bytes: bytes) -> dict:
    """
    Analyze a JPEG frame and return a wellness analysis dict.

    Args:
        jpeg_bytes: Raw JPEG image data.

    Returns:
        dict with wellness fields: presence, posture, eye_strain, hydration,
        focus_state, environment, overall_wellness, frame_summary.
    """
    client = _get_client()

    b64_image = base64.b64encode(jpeg_bytes).decode("utf-8")

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": WELLNESS_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"},
                    },
                ],
            }
        ],
        max_tokens=1024,
        temperature=0.1,
    )

    raw = response.choices[0].message.content.strip()

    # Strip accidental markdown fences
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = dict(_DEFAULT_RESULT)

    return result
