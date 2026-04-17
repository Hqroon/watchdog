from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from auth import hash_password

DB_PATH = Path(__file__).parent / "watchdog.db"

DEFAULT_ADMIN_EMAIL = "admin@watchdog.local"
DEFAULT_ADMIN_PASSWORD = "Admin1234!"


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                email            TEXT UNIQUE NOT NULL,
                hashed_password  TEXT,
                display_name     TEXT,
                auth_provider    TEXT NOT NULL DEFAULT 'local',
                created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login       TIMESTAMP
            )
        """)
        conn.commit()

        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?", (DEFAULT_ADMIN_EMAIL,)
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO users (email, hashed_password, display_name, auth_provider) VALUES (?, ?, ?, ?)",
                (DEFAULT_ADMIN_EMAIL, hash_password(DEFAULT_ADMIN_PASSWORD), "Admin", "local"),
            )
            conn.commit()


def get_user_by_email(email: str) -> Optional[dict]:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None


def create_user(
    email: str,
    display_name: str,
    hashed_password: Optional[str],
    auth_provider: str,
) -> dict:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO users (email, hashed_password, display_name, auth_provider) VALUES (?, ?, ?, ?)",
            (email, hashed_password, display_name, auth_provider),
        )
        conn.commit()
    return get_user_by_email(email)


def update_last_login(email: str) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE users SET last_login = ? WHERE email = ?",
            (datetime.now(timezone.utc).isoformat(), email),
        )
        conn.commit()
