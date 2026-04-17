"""
Ollama coaching module for Lance.

Calls a local Ollama instance to generate a friendly,
actionable coaching message based on the Gemini safety analysis.
"""

from __future__ import annotations

import os
import re

import httpx
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
TIMEOUT = 30.0  # seconds
PULL_TIMEOUT = 180.0  # seconds


COACHING_SYSTEM = (
    "You are a friendly, encouraging personal wellness coach. "
    "Your tone is warm and supportive — never judgmental. "
    "Reply ONLY with the coaching message itself — no preamble, no intro like 'Sure' or 'Here is', no labels. "
    "Keep responses to 2-3 sentences maximum."
)


def _build_prompt(analysis: dict) -> str:
    summary = analysis.get("frame_summary", "Wellness issue detected.")

    details = []

    posture = analysis.get("posture", {})
    if posture.get("status") in ("warning", "poor"):
        issues = ", ".join(posture.get("issues", [])) or posture.get("description", "")
        details.append(f"Posture: {issues}")

    eye = analysis.get("eye_strain", {})
    if eye.get("detected"):
        details.append(f"Eye strain: {eye.get('description', eye.get('severity', ''))}")

    focus = analysis.get("focus_state", {})
    if focus.get("state") in ("drowsy", "distracted"):
        details.append(f"Focus state: {focus.get('description', focus.get('state', ''))}")

    hydration = analysis.get("hydration", {})
    if not hydration.get("water_visible"):
        details.append("No water visible on desk")

    env = analysis.get("environment", {})
    if env.get("issues"):
        details.append(f"Environment: {', '.join(env['issues'])}")

    detail_text = "; ".join(details) if details else "general wellness check"
    return (
        f"Observation: {summary}. Concerns: {detail_text}. "
        "Please write a short, encouraging wellness coaching message."
    )


def _pull_model_if_needed() -> bool:
    """Try to pull the configured Ollama model so first-time users can run coaching."""
    try:
        with httpx.Client(timeout=PULL_TIMEOUT) as client:
            pull_resp = client.post(
                f"{OLLAMA_BASE_URL}/api/pull",
                json={"model": OLLAMA_MODEL, "stream": False},
            )
            pull_resp.raise_for_status()
            return True
    except Exception:
        return False


def generate_coaching(analysis: dict) -> str:
    """
    Generate a coaching message via Ollama.

    Args:
        analysis: The dict returned by gemini_analyzer.analyze_frame().

    Returns:
        A coaching string, or a fallback message if Ollama is unavailable.
    """
    prompt = _build_prompt(analysis)

    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": COACHING_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
    }

    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            response = client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json=payload,
            )
            # Missing model often returns 404 from Ollama; pull once, then retry.
            if response.status_code == 404 and _pull_model_if_needed():
                response = client.post(
                    f"{OLLAMA_BASE_URL}/api/chat",
                    json=payload,
                )
            response.raise_for_status()
            data = response.json()
            text = data["message"]["content"].strip()
            # Strip common LLM preambles e.g. "Sure, here's a message:", "Here is:"
            text = re.sub(r'^(sure[,.]?\s*)?(here[\s\w]*?:|okay[,.]?\s*)', '', text, flags=re.IGNORECASE).strip()
            # Strip leading quotes if the model wrapped the message
            text = text.strip('"').strip("'")
            return text
    except httpx.ConnectError:
        return (
            "Wellness check triggered. Take a moment to sit up straight, "
            "take a deep breath, and have some water. Coaching unavailable (Ollama not running)."
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return (
                "Wellness check triggered. Coaching unavailable (model not found). "
                f"Run: ollama pull {OLLAMA_MODEL}"
            )
        return f"Wellness check triggered. Coaching unavailable ({exc})."
    except Exception as exc:  # noqa: BLE001
        return f"Wellness check triggered. Coaching unavailable ({exc})."
