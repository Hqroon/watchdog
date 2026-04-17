"""
Ollama coaching module for WatchDog.

Calls a local Ollama instance to generate a friendly,
actionable coaching message based on the Gemini safety analysis.
"""

from __future__ import annotations

import os

import httpx
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
TIMEOUT = 30.0  # seconds


COACHING_SYSTEM = (
    "You are a friendly, encouraging workplace safety coach. "
    "Your tone is supportive — never accusatory. "
    "Keep responses to 2-3 sentences maximum."
)


def _build_prompt(analysis: dict) -> str:
    summary = analysis.get("frame_summary", "Safety issue detected.")
    ppe = analysis.get("ppe_violations", [])
    posture = analysis.get("posture_issues", [])
    housekeeping = analysis.get("housekeeping_issues", [])

    details = []
    for v in ppe:
        details.append(f"PPE violation: {v.get('description', v.get('item', ''))}")
    for p in posture:
        details.append(f"Posture issue: {p.get('description', p.get('issue', ''))}")
    for h in housekeeping:
        details.append(f"Housekeeping: {h.get('description', h.get('issue', ''))}")

    detail_text = "; ".join(details) if details else "follow standard procedures"
    return (
        f"Scene: {summary}. Issues found: {detail_text}. "
        "Please write a short coaching message for the worker to correct this safely."
    )


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
            response.raise_for_status()
            data = response.json()
            return data["message"]["content"].strip()
    except httpx.ConnectError:
        return (
            "Safety issue detected. Please review the recommendation and follow "
            "standard operating procedures. Contact your supervisor if unsure."
        )
    except Exception as exc:  # noqa: BLE001
        return f"Safety issue detected. Coaching unavailable ({exc})."
