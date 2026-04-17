"""
In-memory incident store for WatchDog.
Keeps a bounded ring-buffer of the last MAX_INCIDENTS events
and exposes helpers consumed by the REST + WebSocket layers.
"""

from __future__ import annotations

import time
import uuid
from collections import deque
from dataclasses import dataclass, field, asdict
from typing import Deque, List, Optional

MAX_INCIDENTS = 200


@dataclass
class Incident:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    severity: str = "low"          # "low" | "medium" | "high"
    category: str = ""             # e.g. "PPE", "posture", "proximity"
    description: str = ""          # raw Gemini description
    coach_message: str = ""        # Ollama coaching text
    frame_b64: Optional[str] = None  # base-64 JPEG thumbnail (optional)
    resolved: bool = False

    def to_dict(self) -> dict:
        d = asdict(self)
        d["frame_b64"] = None      # never serialise raw frame over REST
        return d


class IncidentStore:
    def __init__(self, maxlen: int = MAX_INCIDENTS) -> None:
        self._store: Deque[Incident] = deque(maxlen=maxlen)

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------
    def add(self, incident: Incident) -> Incident:
        self._store.appendleft(incident)
        return incident

    def resolve(self, incident_id: str) -> bool:
        for inc in self._store:
            if inc.id == incident_id:
                inc.resolved = True
                return True
        return False

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------
    def all(self, limit: int = 50) -> List[Incident]:
        return list(self._store)[:limit]

    def unresolved(self) -> List[Incident]:
        return [i for i in self._store if not i.resolved]

    def by_severity(self, severity: str) -> List[Incident]:
        return [i for i in self._store if i.severity == severity]

    def stats(self) -> dict:
        total = len(self._store)
        by_sev: dict = {"low": 0, "medium": 0, "high": 0}
        for inc in self._store:
            if inc.severity in by_sev:
                by_sev[inc.severity] += 1
        return {
            "total": total,
            "unresolved": len(self.unresolved()),
            "by_severity": by_sev,
        }


# Singleton used by other modules
store = IncidentStore()
