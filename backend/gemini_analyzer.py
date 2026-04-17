"""
Gemini 1.5 Flash vision analyzer for WatchDog.

Sends a JPEG frame to Gemini and returns a structured safety analysis.
"""

from __future__ import annotations

import json
import os
import re
from typing import Optional

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = "gemini-1.5-flash"

SAFETY_PROMPT = """
You are an AI-powered workstation safety inspector for a smart manufacturing facility.

Analyze the provided image and return a JSON object with EXACTLY these fields:
{
  "safe": true or false,
  "severity": "low" | "medium" | "high",
  "category": one of ["PPE", "posture", "proximity", "housekeeping", "tool_use", "none"],
  "description": "One concise sentence describing the observation.",
  "recommendations": ["action 1", "action 2"]
}

Safety rules to enforce:
- Workers must wear hard hats and high-visibility vests where applicable.
- Proper ergonomic posture must be maintained (no hunching, awkward bending).
- Minimum 1-metre clearance around moving machinery.
- No loose cables or debris on walking paths.
- Correct tool handling and storage.

If the scene is safe, set "safe": true, "severity": "low", "category": "none".
Respond ONLY with the JSON object — no markdown fences, no extra text.
"""

_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise EnvironmentError(
                "GEMINI_API_KEY is not set. Add it to your .env file."
            )
        _client = genai.Client(api_key=GEMINI_API_KEY)
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

    image_part = types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg")

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[SAFETY_PROMPT, image_part],
        config=types.GenerateContentConfig(
            temperature=0.1,
            max_output_tokens=512,
        ),
    )

    raw = response.text.strip()

    # Strip accidental markdown fences
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {
            "safe": True,
            "severity": "low",
            "category": "none",
            "description": "Could not parse Gemini response.",
            "recommendations": [],
        }

    return result
