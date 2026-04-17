from __future__ import annotations

import os
from typing import Optional

import httpx
import msal
from dotenv import load_dotenv

load_dotenv()

MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID", "")
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET", "")
MICROSOFT_TENANT_ID = os.getenv("MICROSOFT_TENANT_ID", "common")
MICROSOFT_REDIRECT_URI = os.getenv(
    "MICROSOFT_REDIRECT_URI", "http://localhost:5173/auth/callback"
)

SCOPES = ["User.Read", "openid", "profile", "email"]


def _get_msal_app() -> msal.ConfidentialClientApplication:
    authority = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}"
    return msal.ConfidentialClientApplication(
        MICROSOFT_CLIENT_ID,
        authority=authority,
        client_credential=MICROSOFT_CLIENT_SECRET,
    )


def get_auth_url() -> str:
    app = _get_msal_app()
    return app.get_authorization_request_url(
        scopes=SCOPES,
        redirect_uri=MICROSOFT_REDIRECT_URI,
    )


def exchange_code_for_token(code: str) -> Optional[dict]:
    app = _get_msal_app()
    result = app.acquire_token_by_authorization_code(
        code=code,
        scopes=SCOPES,
        redirect_uri=MICROSOFT_REDIRECT_URI,
    )
    if "error" in result:
        return None
    return result


def get_microsoft_user_info(access_token: str) -> Optional[dict]:
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "id": data.get("id"),
                "displayName": data.get("displayName"),
                "mail": data.get("mail"),
                "userPrincipalName": data.get("userPrincipalName"),
            }
    except Exception:
        return None
