"""
Time-based wellness logic for Lance.

Tracks state across frames and emits alerts that cannot be derived
from a single-frame GPT-4o result (hydration timer, stand-up reminders,
overwork detection, posture streaks, drowsiness, sudden absence).
"""

from __future__ import annotations

import time
from collections import deque
from datetime import datetime, timedelta
from typing import Optional

_HYDRATION_COOLDOWN_MINUTES = 20
_STAND_UP_INTERVAL_MINUTES = 45
_OVERWORK_START_MINUTES = 90
_OVERWORK_REPEAT_MINUTES = 60
_POSTURE_STREAK_FRAMES = 5
_DROWSY_STREAK_FRAMES = 3
_ABSENCE_WINDOW = 3


class WellnessTracker:
    def __init__(self) -> None:
        self.session_start: datetime = datetime.now()

        self.last_water_seen: Optional[datetime] = None
        self.last_stand_reminder: Optional[datetime] = None
        self.last_break_reminder: Optional[datetime] = None
        self.last_overwork_alert: Optional[datetime] = None

        self.consecutive_poor_posture_frames: int = 0
        self.consecutive_drowsy_frames: int = 0

        self.total_frames_analyzed: int = 0
        self.frames_with_person: int = 0

        # Rolling window of last 20 posture scores
        self.posture_scores: deque = deque(maxlen=20)

        # Last N presence booleans for sudden-absence detection
        self._presence_history: deque = deque(maxlen=_ABSENCE_WINDOW + 1)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def update(self, analysis: dict) -> list[dict]:
        """
        Consume one frame's analysis and return a list of time-based alerts.
        Each alert: { type, severity, message, category }
        """
        now = datetime.now()
        alerts: list[dict] = []

        presence = analysis.get("presence", False)
        posture = analysis.get("posture", {})
        focus = analysis.get("focus_state", {})
        hydration = analysis.get("hydration", {})

        self.total_frames_analyzed += 1
        if presence:
            self.frames_with_person += 1

        score = posture.get("score", 50)
        self.posture_scores.append(score)

        session_minutes = (now - self.session_start).total_seconds() / 60

        # ---- HYDRATION TIMER ----------------------------------------
        if hydration.get("water_visible", False):
            self.last_water_seen = now

        water_absent_long_enough = (
            self.last_water_seen is None
            or (now - self.last_water_seen).total_seconds() / 60 >= _HYDRATION_COOLDOWN_MINUTES
        )
        if water_absent_long_enough:
            alerts.append({
                "type": "hydration",
                "severity": "warning",
                "message": "No water detected in the last 20 minutes — time to hydrate",
                "category": "HYDRATION",
            })
            # Reset so this fires at most once per cooldown window
            self.last_water_seen = now

        # ---- STAND UP REMINDER --------------------------------------
        if session_minutes >= _STAND_UP_INTERVAL_MINUTES:
            intervals_elapsed = int(session_minutes / _STAND_UP_INTERVAL_MINUTES)
            next_remind = intervals_elapsed * _STAND_UP_INTERVAL_MINUTES
            within_window = (session_minutes - next_remind) < 0.5  # 30-second fire window

            last_ok = (
                self.last_stand_reminder is None
                or (now - self.last_stand_reminder).total_seconds() / 60
                >= (_STAND_UP_INTERVAL_MINUTES - 1)
            )
            if within_window and last_ok:
                alerts.append({
                    "type": "stand_up",
                    "severity": "info",
                    "message": (
                        "You have been sitting for 45 minutes — "
                        "stand up and stretch for 2 minutes"
                    ),
                    "category": "MOVEMENT",
                })
                self.last_stand_reminder = now

        # ---- OVERWORK DETECTION -------------------------------------
        if (
            session_minutes > _OVERWORK_START_MINUTES
            and self.total_frames_analyzed > 0
            and self.frames_with_person / self.total_frames_analyzed > 0.8
        ):
            overwork_ok = (
                self.last_overwork_alert is None
                or (now - self.last_overwork_alert).total_seconds() / 60
                >= _OVERWORK_REPEAT_MINUTES
            )
            if overwork_ok:
                hours = round(session_minutes / 60, 1)
                alerts.append({
                    "type": "overwork",
                    "severity": "warning",
                    "message": (
                        f"You have been working for over {hours} hours — "
                        "consider taking a proper break"
                    ),
                    "category": "OVERWORK",
                })
                self.last_overwork_alert = now

        # ---- POSTURE STREAK -----------------------------------------
        posture_status = posture.get("status", "good")
        if posture_status == "poor":
            self.consecutive_poor_posture_frames += 1
        else:
            self.consecutive_poor_posture_frames = 0

        if self.consecutive_poor_posture_frames >= _POSTURE_STREAK_FRAMES:
            alerts.append({
                "type": "posture_streak",
                "severity": "warning",
                "message": (
                    "You have had poor posture for 30 seconds straight — "
                    "sit up and reset your position"
                ),
                "category": "POSTURE",
            })
            self.consecutive_poor_posture_frames = 0

        # ---- DROWSINESS DETECTION -----------------------------------
        focus_state = focus.get("state", "focused")
        if focus_state == "drowsy":
            self.consecutive_drowsy_frames += 1
        else:
            self.consecutive_drowsy_frames = 0

        if self.consecutive_drowsy_frames >= _DROWSY_STREAK_FRAMES:
            alerts.append({
                "type": "drowsy",
                "severity": "critical",
                "message": (
                    "You appear to be falling asleep — stand up, "
                    "splash water on your face, or take a short break"
                ),
                "category": "COLLAPSE_RISK",
            })
            self.consecutive_drowsy_frames = 0

        # ---- SUDDEN ABSENCE (COLLAPSE RISK) -------------------------
        prev_history = list(self._presence_history)
        self._presence_history.append(presence)

        if (
            not presence
            and len(prev_history) >= _ABSENCE_WINDOW
            and all(prev_history[-_ABSENCE_WINDOW:])
        ):
            alerts.append({
                "type": "absence_alert",
                "severity": "critical",
                "message": (
                    "You suddenly disappeared from view — are you okay?"
                ),
                "category": "COLLAPSE_RISK",
            })

        return alerts

    def get_session_stats(self) -> dict:
        now = datetime.now()
        session_minutes = (now - self.session_start).total_seconds() / 60
        avg_score = (
            sum(self.posture_scores) / len(self.posture_scores)
            if self.posture_scores
            else 0.0
        )
        time_since_water: float | None = (
            (now - self.last_water_seen).total_seconds() / 60
            if self.last_water_seen
            else None
        )
        presence_ratio = (
            self.frames_with_person / self.total_frames_analyzed
            if self.total_frames_analyzed
            else 0.0
        )
        return {
            "session_duration_minutes": round(session_minutes, 1),
            "total_frames": self.total_frames_analyzed,
            "avg_posture_score": round(avg_score, 1),
            "time_since_water_minutes": (
                round(time_since_water, 1) if time_since_water is not None else None
            ),
            "presence_ratio": round(presence_ratio, 2),
        }
