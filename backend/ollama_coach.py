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
    category = analysis.get("category", "general")
    description = analysis.get("description", "")
    recommendations = analysis.get("recommendations", [])
    rec_text = "; ".join(recommendations) if recommendations else "follow standard procedures"

    return (
        f"A safety issue was detected in category '{category}': {description}. "
        f"Recommended actions: {rec_text}. "
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
