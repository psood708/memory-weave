import asyncpg
from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt

from memoryweave.auth.models import UserSession
from memoryweave.core.config import settings
from memoryweave.db.database import get_db, new_uuid

_COOKIE_NAME = "authjs.session-token"


async def verify_session(
    request: Request,
    db: asyncpg.Connection = Depends(get_db),
) -> UserSession:
    token = request.cookies.get(_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not settings.auth_secret:
        raise HTTPException(status_code=500, detail="Server misconfiguration: AUTH_SECRET not set")
    try:
        payload = jwt.decode(token, settings.auth_secret, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid session token")

    google_sub: str = payload.get("sub", "")
    email: str = payload.get("email", "")
    name: str = payload.get("name", "")
    provider: str = payload.get("provider", "google")

    row = await db.fetchrow(
        "SELECT id, email, name FROM users WHERE google_sub = $1 AND provider = $2",
        google_sub, provider,
    )
    if row is None:
        user_id = new_uuid()
        await db.execute(
            "INSERT INTO users (id, google_sub, email, name, provider) VALUES ($1, $2, $3, $4, $5)",
            user_id, google_sub, email, name, provider,
        )
    else:
        user_id = row["id"]

    return UserSession(user_id=user_id, email=email, name=name)
