"""
OpenAI GPT-4o vision analyzer for Lance.

Sends a JPEG frame to GPT-4o and returns a structured safety analysis.
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

SAFETY_PROMPT = """You are a factory floor safety and quality inspector. Analyze this image and return ONLY a raw JSON object — no markdown, no code fences, no explanation.

Detect and locate everything you can see from these categories:
- PERSON: any worker, operator, or human figure
- FOOD_DRINK: food, drink bottles, coffee cups, snacks, any beverage
- WIRES_CABLES: loose, tangled, or floor-level cables and wires
- TOOLS: screwdrivers, pliers, soldering irons, multimeters, any hand tools
- COMPONENTS: PCBs, chips, electronic components, circuit boards
- HAZARDS: spills, blocked pathways, trip hazards, cluttered surfaces
- FIRE_EXIT: fire exit signs or doors, note if blocked

For every single detected object include a bounding box as normalized coordinates where 0.0 is top-left and 1.0 is bottom-right. x and y are the top-left corner of the box.

Return exactly this JSON structure and nothing else:
{
  "detections": [
    {
      "category": "PERSON",
      "label": "operator at workbench",
      "confidence": 0.95,
      "box": { "x": 0.1, "y": 0.05, "w": 0.3, "h": 0.7 },
      "severity": "ok"
    }
  ],
  "posture_issues": [
    { "issue": "forward neck lean", "severity": "warning", "description": "Head angled forward sustained" }
  ],
  "housekeeping_issues": [
    { "issue": "loose cable on floor", "severity": "warning", "description": "Trip hazard near station" }
  ],
  "overall_risk": "medium",
  "frame_summary": "One operator, missing PPE, cable hazard on floor"
}

Severity values must be exactly: critical, warning, ok
Overall risk must be exactly: low, medium, high
Return empty arrays for categories where nothing is detected."""

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
    Analyze a JPEG frame and return a safety-analysis dict.

    Args:
        jpeg_bytes: Raw JPEG image data.

    Returns:
        dict with keys: safe, severity, category, description, recommendations
    """
    client = _get_client()

    b64_image = base64.b64encode(jpeg_bytes).decode("utf-8")

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": SAFETY_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"},
                    },
                ],
            }
        ],
        max_tokens=2048,
        temperature=0.1,
    )

    raw = response.choices[0].message.content.strip()

    # Strip accidental markdown fences
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {
            "detections": [],
            "posture_issues": [],
            "housekeeping_issues": [],
            "overall_risk": "low",
            "frame_summary": "Could not parse OpenAI response.",
        }

    return result
