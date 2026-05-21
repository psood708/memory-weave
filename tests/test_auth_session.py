import pytest
import time
from unittest.mock import AsyncMock, MagicMock
from jose import jwt
from fastapi import Request
from memoryweave.auth.session import verify_session
from memoryweave.auth.models import UserSession

SECRET = "test-secret-32-chars-minimum-ok!"

def _make_token(sub: str = "google-123", email: str = "a@b.com") -> str:
    return jwt.encode(
        {"sub": sub, "email": email, "name": "Test", "exp": time.time() + 3600},
        SECRET,
        algorithm="HS256",
    )

@pytest.mark.asyncio
async def test_verify_session_returns_user_session(monkeypatch):
    monkeypatch.setattr("memoryweave.auth.session.settings.auth_secret", SECRET)
    token = _make_token()

    request = MagicMock(spec=Request)
    request.cookies = {"authjs.session-token": token}

    db = AsyncMock()
    db.execute = AsyncMock(return_value=MagicMock(
        fetchone=AsyncMock(return_value={"id": "uuid-1", "email": "a@b.com", "name": "Test"})
    ))

    result = await verify_session(request, db)
    assert isinstance(result, UserSession)
    assert result.user_id == "uuid-1"
    assert result.email == "a@b.com"

@pytest.mark.asyncio
async def test_verify_session_raises_on_missing_cookie(monkeypatch):
    monkeypatch.setattr("memoryweave.auth.session.settings.auth_secret", SECRET)
    from fastapi import HTTPException
    request = MagicMock(spec=Request)
    request.cookies = {}
    db = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await verify_session(request, db)
    assert exc.value.status_code == 401
