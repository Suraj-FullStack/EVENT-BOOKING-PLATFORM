"""
Idempotent seed script.

    python -m scripts.seed

Creates one admin, one normal user, 14 deterministic sample events (including
one past, one nearly-full and one sold-out event) and a handful of bookings so
the UI has something to show. Safe to run repeatedly: users are looked up by
email, events by title, and bookings by (user, event).

Credentials come from SEED_* environment variables (see .env.example) and
fall back to obvious development-only defaults.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Booking, BookingStatus, Event, User, UserRole

settings = get_settings()

# Anchor every date to "today at 18:00 UTC" so the relative past/future
# split holds no matter when the script is run.
_TODAY = datetime.now(timezone.utc).replace(hour=18, minute=0, second=0, microsecond=0)


def _days(n: int, hour: int = 18) -> datetime:
    return (_TODAY + timedelta(days=n)).replace(hour=hour)


# (title, description, starts_at, venue, total_seats)
SAMPLE_EVENTS: list[tuple[str, str, datetime, str, int]] = [
    ("Intro to Rust Workshop",
     "A hands-on afternoon getting comfortable with ownership, borrowing and cargo. Bring a laptop.",
     _days(-7, 14), "Hack Lab, Building C", 30),  # past event
    ("Design Systems Meetup",
     "Monthly meetup for designers and front-end engineers. This month: tokens and theming at scale.",
     _days(2, 18), "The Loft, 4th Floor", 40),
    ("Startup Pitch Night",
     "Eight early-stage founders, five minutes each, one friendly panel. Networking afterwards.",
     _days(3, 19), "Riverside Auditorium", 5),  # will be full
    ("Cloud Cost Optimisation Clinic",
     "Bring your bill. We walk through real accounts and find savings together.",
     _days(5, 10), "Room 2.14", 12),  # nearly full
    ("Open Source Saturday",
     "Pick a project, find a maintainer, land your first PR before lunch.",
     _days(6, 9), "Community Hall", 60),
    ("Python Data Pipelines 101",
     "From CSV to warehouse: a practical tour of pandas, Arrow and a bit of SQL.",
     _days(8, 17), "Lab 3", 25),
    ("Accessible Web Forms",
     "Why most forms fail screen-reader users and how to fix yours in an afternoon.",
     _days(10, 15), "Studio B", 20),
    ("Product Analytics Deep Dive",
     "Funnels, retention curves and the metrics that actually move decisions.",
     _days(12, 18), "Boardroom 1", 18),
    ("Kubernetes for Mortals",
     "No prior k8s experience needed. Deploy, scale and break a cluster safely.",
     _days(14, 13), "Hack Lab, Building C", 35),
    ("Career Panel: Breaking into Tech",
     "Four engineers from very different backgrounds talk about how they got their first role.",
     _days(16, 18), "Riverside Auditorium", 120),
    ("Postgres Performance Tuning",
     "EXPLAIN ANALYZE without fear. Indexes, locks and the planner demystified.",
     _days(18, 17), "Room 2.14", 24),
    ("Hackathon Kick-off",
     "48 hours, any stack, real judges. Team formation happens on the night.",
     _days(21, 18), "Main Atrium", 80),
    ("TypeScript Type-Level Tricks",
     "Conditional types, template literals and when to stop being clever.",
     _days(24, 18), "Studio B", 30),
    ("Mobile UX Review Session",
     "Bring a prototype and leave with a page of actionable feedback.",
     _days(28, 16), "The Loft, 4th Floor", 15),
]

# Extra throwaway attendees so the "full" and "nearly full" events look real.
FILLER_ATTENDEES = [
    ("Alex Rivera", "alex.rivera@example.com"),
    ("Priya Nair", "priya.nair@example.com"),
    ("Tom Becker", "tom.becker@example.com"),
    ("Mei Lin", "mei.lin@example.com"),
    ("Samuel Okafor", "samuel.okafor@example.com"),
    ("Hannah Ross", "hannah.ross@example.com"),
    ("Diego Martins", "diego.martins@example.com"),
    ("Yuki Tanaka", "yuki.tanaka@example.com"),
    ("Fatima Zahra", "fatima.zahra@example.com"),
    ("Liam O'Connor", "liam.oconnor@example.com"),
]


def get_or_create_user(db: Session, *, name: str, email: str, password: str, role: UserRole) -> User:
    email = email.lower()
    user = db.scalar(select(User).where(User.email == email))
    if user:
        return user
    user = User(name=name, email=email, password_hash=hash_password(password), role=role)
    db.add(user)
    db.flush()
    print(f"  + user   {email} ({role.value})")
    return user


def get_or_create_event(db: Session, title: str, description: str, starts_at: datetime, venue: str, seats: int) -> Event:
    event = db.scalar(select(Event).where(Event.title == title))
    if event:
        return event
    event = Event(title=title, description=description, starts_at=starts_at, venue=venue, total_seats=seats)
    db.add(event)
    db.flush()
    print(f"  + event  {title!r}")
    return event


def ensure_booking(db: Session, user: User, event: Event, *, cancelled: bool = False) -> None:
    exists = db.scalar(
        select(Booking.id).where(Booking.user_id == user.id, Booking.event_id == event.id)
    )
    if exists:
        return
    booking = Booking(
        user_id=user.id,
        event_id=event.id,
        status=BookingStatus.cancelled if cancelled else BookingStatus.active,
        cancelled_at=datetime.now(timezone.utc) if cancelled else None,
    )
    db.add(booking)


def run() -> None:
    print("Seeding EventBook database...")
    with SessionLocal() as db:
        admin = get_or_create_user(
            db, name=settings.seed_admin_name, email=settings.seed_admin_email,
            password=settings.seed_admin_password, role=UserRole.admin,
        )
        user = get_or_create_user(
            db, name=settings.seed_user_name, email=settings.seed_user_email,
            password=settings.seed_user_password, role=UserRole.user,
        )
        fillers = [
            get_or_create_user(db, name=n, email=e, password="Filler12345!", role=UserRole.user)
            for n, e in FILLER_ATTENDEES
        ]

        events = {t: get_or_create_event(db, t, d, s, v, c) for t, d, s, v, c in SAMPLE_EVENTS}

        # Sold out: 5 seats, 5 active bookings
        for f in fillers[:5]:
            ensure_booking(db, f, events["Startup Pitch Night"])

        # Nearly full: 12 seats, 10 active + our demo user = 11 booked, 1 left
        for f in fillers:
            ensure_booking(db, f, events["Cloud Cost Optimisation Clinic"])
        ensure_booking(db, user, events["Cloud Cost Optimisation Clinic"])

        # Demo user's history: a past event, an upcoming one, and a cancellation
        ensure_booking(db, user, events["Intro to Rust Workshop"])
        ensure_booking(db, user, events["Design Systems Meetup"])
        ensure_booking(db, user, events["Open Source Saturday"], cancelled=True)

        # A few more attendees so admin attendee lists aren't empty
        for f in fillers[:3]:
            ensure_booking(db, f, events["Design Systems Meetup"])
            ensure_booking(db, f, events["Postgres Performance Tuning"])

        db.commit()

    print("Done.")
    print(f"  admin login: {settings.seed_admin_email}")
    print(f"  user  login: {settings.seed_user_email}")
    print("  (passwords come from SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD)")
    _ = admin  # keep linters quiet


if __name__ == "__main__":
    run()
