"""
Lance — FastAPI backend
==========================
Endpoints
---------
POST /analyze              Accept a JPEG frame, run GPT-4o + Ollama, return wellness analysis.
GET  /incidents            List recent incidents.
POST /incidents/{id}/resolve  Mark an incident resolved.
GET  /stats                Aggregated stats.
POST /reset-session        Resets the WellnessTracker for a new session.
WS   /ws                   Real-time push of new incidents to connected clients.
"""

from __future__ import annotations

import asyncio
import base64
import logging
from contextlib import asynccontextmanager
from typing import List, Set

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from gemini_analyzer import analyze_frame
from incident_store import Incident, store
from ollama_coach import generate_coaching
from wellness_tracker import WellnessTracker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lance")

# ---------------------------------------------------------------------------
# Singletons
# ---------------------------------------------------------------------------
wellness_tracker = WellnessTracker()


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self) -> None:
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.add(ws)
        logger.info("WS client connected. Total: %d", len(self.active))

    def disconnect(self, ws: WebSocket) -> None:
        self.active.discard(ws)
        logger.info("WS client disconnected. Total: %d", len(self.active))

    async def broadcast(self, data: dict) -> None:
        dead: Set[WebSocket] = set()
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        self.active -= dead


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Lance backend starting…")
    yield
    logger.info("Lance backend stopping…")


app = FastAPI(title="Lance API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    """
    Accepts a JPEG image, runs GPT-4o wellness analysis and Ollama coaching.
    Stores an Incident when overall_wellness is 'poor' or a critical time alert fires.
    Broadcasts over WebSocket.
    """
    global wellness_tracker

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    jpeg_bytes = await file.read()

    loop = asyncio.get_event_loop()
    try:
        analysis = await loop.run_in_executor(None, analyze_frame, jpeg_bytes)
    except Exception as exc:
        logger.error("GPT-4o error: %s", exc)
        raise HTTPException(status_code=502, detail=f"GPT-4o error: {exc}") from exc

    # Time-based alerts from tracker
    time_alerts = wellness_tracker.update(analysis)
    session_stats = wellness_tracker.get_session_stats()

    incident = None
    coach_msg = None

    overall_wellness = analysis.get("overall_wellness", "good")
    has_critical_alert = any(a.get("severity") == "critical" for a in time_alerts)

    if overall_wellness == "poor" or has_critical_alert:
        try:
            coach_msg = await loop.run_in_executor(None, generate_coaching, analysis)
        except Exception as exc:
            logger.warning("Ollama error (non-fatal): %s", exc)
            coach_msg = "Wellness issue detected. Take a moment to check in with yourself."

        # Derive incident category from the most urgent signal
        focus_state = analysis.get("focus_state", {}).get("state", "")
        posture_status = analysis.get("posture", {}).get("status", "good")
        eye_sev = analysis.get("eye_strain", {}).get("severity", "none")

        if any(a.get("category") == "COLLAPSE_RISK" for a in time_alerts) or focus_state == "drowsy":
            category = "collapse_risk"
        elif posture_status == "poor":
            category = "posture"
        elif eye_sev in ("mild", "severe"):
            category = "eye_strain"
        else:
            category = "wellness"

        severity = "high" if has_critical_alert else "medium"

        incident = Incident(
            severity=severity,
            category=category,
            description=analysis.get("frame_summary", ""),
            coach_message=coach_msg,
            frame_b64=base64.b64encode(jpeg_bytes).decode() if len(jpeg_bytes) < 500_000 else None,
        )
        store.add(incident)

        await manager.broadcast(
            {
                "event": "new_incident",
                "incident": incident.to_dict(),
                "coach": coach_msg,
                "time_based_alerts": time_alerts,
                "session_stats": session_stats,
                "stats": store.stats(),
            }
        )

    return JSONResponse(
        {
            "analysis": analysis,
            "time_based_alerts": time_alerts,
            "session_stats": session_stats,
            "incident_id": incident.id if incident else None,
            "incident": incident.to_dict() if incident else None,
            "coach": coach_msg if incident else None,
        }
    )


@app.get("/incidents")
async def get_incidents(limit: int = 50):
    return [i.to_dict() for i in store.all(limit=limit)]


@app.post("/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str):
    status = store.resolve(incident_id)
    if status == "not_found":
        raise HTTPException(status_code=404, detail="Incident not found.")
    incident = store.get(incident_id)
    stats = store.stats()
    if status == "resolved":
        await manager.broadcast(
            {
                "event": "incident_resolved",
                "incident_id": incident_id,
                "incident": incident.to_dict() if incident else None,
                "stats": stats,
            }
        )
    return {
        "resolved": status == "resolved",
        "already_resolved": status == "already_resolved",
        "incident": incident.to_dict() if incident else None,
        "stats": stats,
    }


@app.get("/stats")
async def get_stats():
    return store.stats()


@app.post("/reset-session")
async def reset_session():
    """Resets the WellnessTracker — clears all session timing state."""
    global wellness_tracker
    wellness_tracker = WellnessTracker()
    logger.info("Session reset.")
    return {"message": "Session reset"}


@app.post("/incidents/seed")
async def seed_incident(body: dict):
    """Dev-only endpoint used by seed_incidents.py to inject fake data."""
    inc = Incident(
        timestamp=body.get("timestamp", __import__("time").time()),
        severity=body.get("severity", "low"),
        category=body.get("category", "none"),
        description=body.get("description", ""),
        coach_message=body.get("coach_message", ""),
        resolved=body.get("resolved", False),
    )
    store.add(inc)
    await manager.broadcast(
        {
            "event": "new_incident",
            "incident": inc.to_dict(),
            "coach": inc.coach_message,
            "stats": store.stats(),
        }
    )
    return inc.to_dict()


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_json({"event": "connected", "stats": store.stats()})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
