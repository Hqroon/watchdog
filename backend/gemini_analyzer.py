"""
Gemini 1.5 Flash vision analyzer for WatchDog.

Sends a JPEG frame to Gemini and returns a structured safety analysis.
"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Optional

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = "gemini-1.5-flash"

# System prompt injected with every request
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


def _init_model() -> genai.GenerativeModel:
    if not GEMINI_API_KEY:
        raise EnvironmentError(
            "GEMINI_API_KEY is not set. Add it to your .env file."
        )
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel(MODEL_NAME)


_model: Optional[genai.GenerativeModel] = None


def _get_model() -> genai.GenerativeModel:
    global _model
    if _model is None:
        _model = _init_model()
    return _model


def analyze_frame(jpeg_bytes: bytes) -> dict:
    """
    Analyze a JPEG frame and return a safety-analysis dict.

    Args:
        jpeg_bytes: Raw JPEG image data.

    Returns:
        dict with keys: safe, severity, category, description, recommendations
    """
    model = _get_model()

    image_part = {
        "mime_type": "image/jpeg",
        "data": base64.b64encode(jpeg_bytes).decode("utf-8"),
    }

    response = model.generate_content(
        [SAFETY_PROMPT, image_part],
        generation_config=genai.GenerationConfig(
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
        # Fallback: treat as unknown / low severity
        result = {
            "safe": True,
            "severity": "low",
            "category": "none",
            "description": "Could not parse Gemini response.",
            "recommendations": [],
        }

    return result
