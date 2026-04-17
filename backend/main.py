"""
WatchDog — FastAPI backend
"""

from __future__ import annotations

import asyncio
import base64
import logging
import re
from contextlib import asynccontextmanager
from typing import Optional, Set

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

from auth import create_access_token, decode_token, hash_password, verify_password
from gemini_analyzer import analyze_frame
from incident_store import Incident, store
from microsoft_auth import exchange_code_for_token, get_auth_url, get_microsoft_user_info
from ollama_coach import generate_coaching
from user_store import create_user, get_user_by_email, init_db, update_last_login

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("watchdog")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


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
    init_db()
    logger.info("WatchDog backend starting…")
    yield
    logger.info("WatchDog backend stopping…")


app = FastAPI(title="WatchDog API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@app.post("/auth/register")
async def register(body: RegisterRequest):
    if not re.match(r"^[^@]+@[^@]+\.[^@]+$", body.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if get_user_by_email(body.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    create_user(body.email, body.display_name, hash_password(body.password), "local")
    return {"message": "User created"}


@app.post("/auth/login")
async def login(body: LoginRequest):
    user = get_user_by_email(body.email)
    if not user or user["auth_provider"] != "local":
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    update_last_login(body.email)
    token = create_access_token({"sub": user["email"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"email": user["email"], "display_name": user["display_name"]},
    }


@app.get("/auth/microsoft")
async def microsoft_login():
    return {"auth_url": get_auth_url()}


@app.get("/auth/microsoft/callback")
async def microsoft_callback(code: str = Query(...)):
    token_result = exchange_code_for_token(code)
    if not token_result:
        raise HTTPException(status_code=400, detail="Failed to exchange code for token")
    access_token = token_result.get("access_token")
    user_info = get_microsoft_user_info(access_token)
    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to get user info from Microsoft")
    email = user_info.get("mail") or user_info.get("userPrincipalName")
    if not email:
        raise HTTPException(status_code=400, detail="Could not determine email from Microsoft account")
    display_name = user_info.get("displayName") or email
    user = get_user_by_email(email)
    if not user:
        user = create_user(email, display_name, None, "microsoft")
    update_last_login(email)
    jwt_token = create_access_token({"sub": email})
    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "user": {"email": email, "display_name": display_name},
    }


@app.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {k: v for k, v in current_user.items() if k != "hashed_password"}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Protected routes
# ---------------------------------------------------------------------------
@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    jpeg_bytes = await file.read()

    loop = asyncio.get_event_loop()
    try:
        analysis = await loop.run_in_executor(None, analyze_frame, jpeg_bytes)
    except Exception as exc:
        logger.error("OpenAI error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Analysis error: {exc}") from exc

    overall_risk = analysis.get("overall_risk", "low")
    incident = None
    if overall_risk in ("medium", "high"):
        try:
            coach_msg = await loop.run_in_executor(None, generate_coaching, analysis)
        except Exception as exc:
            logger.warning("Ollama error (non-fatal): %s", exc)
            coach_msg = "Safety issue detected. Please follow standard procedures."

        posture = analysis.get("posture_issues", [])
        if posture:
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
async def get_incidents(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    return [i.to_dict() for i in store.all(limit=limit)]


@app.post("/incidents/{incident_id}/resolve")
async def resolve_incident(
    incident_id: str,
    current_user: dict = Depends(get_current_user),
):
    ok = store.resolve(incident_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Incident not found.")
    await manager.broadcast({"event": "incident_resolved", "incident_id": incident_id})
    return {"resolved": True}


@app.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    return store.stats()


@app.post("/incidents/seed")
async def seed_incident(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
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
# WebSocket — token passed as query param
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    payload = decode_token(token) if token else None
    if not payload:
        await websocket.close(code=4001)
        return

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
