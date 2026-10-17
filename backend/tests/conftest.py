"""
Test fixtures.

Tests run against a real PostgreSQL database (TEST_DATABASE_URL) because the
booking logic relies on `SELECT ... FOR UPDATE` and a partial unique index -
both of which SQLite can't faithfully emulate. The schema is created fresh
at the start of the session and every table is truncated between tests.

Never point TEST_DATABASE_URL at a database you care about.
"""
import os
from datetime import datetime, timedelta, timezone

# Settings must be in place before the app modules are imported.
os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/eventbook_test"),
)
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-not-for-production-at-least-32-bytes")
os.environ.setdefault("FRONTEND_ORIGIN", "http://testserver")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.main import app
from app.models import Booking, BookingStatus, Event, User, UserRole


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def _clean_tables():
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE bookings, events, users RESTART IDENTITY CASCADE"))


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    # raise_server_exceptions=False so we can assert on our 500 envelope too.
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Factories
# ---------------------------------------------------------------------------

def make_user(db, email="user@test.dev", role=UserRole.user, name="Test User", password="Password123!") -> User:
    user = User(name=name, email=email, password_hash=hash_password(password), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_event(db, *, title="Test Event", seats=10, days_from_now=7, venue="Hall A") -> Event:
    event = Event(
        title=title,
        description="Some description",
        starts_at=datetime.now(timezone.utc) + timedelta(days=days_from_now),
        venue=venue,
        total_seats=seats,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def make_booking(db, user: User, event: Event, status=BookingStatus.active) -> Booking:
    booking = Booking(user_id=user.id, event_id=event.id, status=status)
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def login(client: TestClient, email: str, password="Password123!") -> dict:
    """Log in and return headers that authenticate subsequent requests."""
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    token = res.cookies.get("eventbook_access")
    # The TestClient keeps cookies between requests; drop them so each request
    # is authenticated *only* by the explicit Bearer header we return here.
    client.cookies.clear()
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def user(db):
    return make_user(db)


@pytest.fixture
def other_user(db):
    return make_user(db, email="other@test.dev", name="Other User")


@pytest.fixture
def admin(db):
    return make_user(db, email="admin@test.dev", role=UserRole.admin, name="Admin")


@pytest.fixture
def user_headers(client, user):
    return login(client, user.email)


@pytest.fixture
def other_headers(client, other_user):
    return login(client, other_user.email)


@pytest.fixture
def admin_headers(client, admin):
    return login(client, admin.email)
