"""
FastAPI dependencies for auth.

The access token lives in an HttpOnly cookie. We also accept a Bearer header
so the API can be exercised from curl / Postman / the test suite without
juggling cookies.
"""
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import User


def _extract_token(request: Request) -> str | None:
    settings = get_settings()
    cookie = request.cookies.get(settings.auth_cookie_name)
    if cookie:
        return cookie
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip() or None
    return None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = _extract_token(request)
    if not token:
        raise UnauthorizedError("Authentication required", code="not_authenticated")
    user_id = decode_access_token(token)
    if user_id is None:
        raise UnauthorizedError("Session is invalid or has expired", code="invalid_token")
    user = db.get(User, user_id)
    if not user:
        raise UnauthorizedError("Session is invalid or has expired", code="invalid_token")
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise ForbiddenError("Admin access required", code="admin_required")
    return user
