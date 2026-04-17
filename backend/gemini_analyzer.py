"""
OpenAI GPT-4o vision analyzer for WatchDog.

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
        max_tokens=512,
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
            "safe": True,
            "severity": "low",
            "category": "none",
            "description": "Could not parse OpenAI response.",
            "recommendations": [],
        }

    return result
