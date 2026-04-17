"""
WatchDog — FastAPI backend
==========================
Endpoints
---------
POST /analyze          Accept a JPEG frame, run Gemini + Ollama, return analysis.
GET  /incidents        List recent incidents.
POST /incidents/{id}/resolve  Mark an incident resolved.
GET  /stats            Aggregated stats.
WS   /ws               Real-time push of new incidents to connected clients.
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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("watchdog")

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
    logger.info("WatchDog backend starting…")
    yield
    logger.info("WatchDog backend stopping…")


app = FastAPI(title="WatchDog API", version="0.1.0", lifespan=lifespan)

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
    Accepts a JPEG image, runs Gemini vision analysis and Ollama coaching.
    Stores the result as an Incident if a hazard is detected.
    Broadcasts the incident over WebSocket.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    jpeg_bytes = await file.read()

    # --- Gemini analysis (blocking — run in thread pool) -----------------
    loop = asyncio.get_event_loop()
    try:
        analysis = await loop.run_in_executor(None, analyze_frame, jpeg_bytes)
    except Exception as exc:
        logger.error("Gemini error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Gemini error: {exc}") from exc

    overall_risk = analysis.get("overall_risk", "low")
    incident = None
    if overall_risk in ("medium", "high"):
        # --- Ollama coaching (blocking) -----------------------------------
        try:
            coach_msg = await loop.run_in_executor(None, generate_coaching, analysis)
        except Exception as exc:
            logger.warning("Ollama error (non-fatal): %s", exc)
            coach_msg = "Safety issue detected. Please follow standard procedures."

        ppe = analysis.get("ppe_violations", [])
        posture = analysis.get("posture_issues", [])
        if ppe:
            category = "PPE"
        elif posture:
            category = "posture"
        elif analysis.get("housekeeping_issues"):
            category = "housekeeping"
        else:
            category = "hazard"

        incident = Incident(
            severity=overall_risk,
            category=category,
            description=analysis.get("frame_summary", ""),
            coach_message=coach_msg,
            frame_b64=base64.b64encode(jpeg_bytes).decode() if len(jpeg_bytes) < 500_000 else None,
        )
        store.add(incident)

        # Broadcast to WebSocket clients
        await manager.broadcast(
            {
                "event": "new_incident",
                "incident": incident.to_dict(),
                "coach": coach_msg,
            }
        )

    return JSONResponse(
        {
            "analysis": analysis,
            "incident_id": incident.id if incident else None,
        }
    )


@app.get("/incidents")
async def get_incidents(limit: int = 50):
    return [i.to_dict() for i in store.all(limit=limit)]


@app.post("/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str):
    ok = store.resolve(incident_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Incident not found.")
    await manager.broadcast({"event": "incident_resolved", "incident_id": incident_id})
    return {"resolved": True}


@app.get("/stats")
async def get_stats():
    return store.stats()


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
    await manager.broadcast({"event": "new_incident", "incident": inc.to_dict(), "coach": inc.coach_message})
    return inc.to_dict()


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send current stats on connect
        await websocket.send_json({"event": "connected", "stats": store.stats()})
        while True:
            # Keep connection alive; clients can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
