"""User registration and login."""
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import hash_password, verify_password
from app.models import User, UserRole
from app.schemas.user import LoginRequest, RegisterRequest


def register_user(db: Session, payload: RegisterRequest) -> User:
    email = payload.email.lower().strip()

    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        raise ConflictError("An account with this email already exists", code="email_taken")

    # Role is hard-coded here on purpose - see Section 4 of the spec.
    user = User(
        name=payload.name,
        email=email,
        password_hash=hash_password(payload.password),
        role=UserRole.user,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Two registrations raced on the same email; the unique index wins.
        db.rollback()
        raise ConflictError("An account with this email already exists", code="email_taken")
    db.refresh(user)
    return user


def authenticate_user(db: Session, payload: LoginRequest) -> User:
    email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    # Same error for "no such user" and "wrong password" so we don't leak
    # which emails are registered.
    if not user or not verify_password(payload.password, user.password_hash):
        raise UnauthorizedError("Invalid email or password", code="invalid_credentials")
    return user
