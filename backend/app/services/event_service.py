"""
Event queries and admin event management.

Availability is never stored - it's always `total_seats - count(active
bookings)` computed in SQL, so there's no counter to drift out of sync.
"""
import math
from datetime import datetime, timezone

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models import Booking, BookingStatus, Event, User
from app.schemas.event import AttendeeOut, EventCreate, EventOut, EventUpdate

MAX_PAGE_SIZE = 50


def _now() -> datetime:
    return datetime.now(timezone.utc)


# Scalar subquery: number of active bookings for an event row.
_active_count_sq = (
    select(func.count(Booking.id))
    .where(Booking.event_id == Event.id, Booking.status == BookingStatus.active)
    .correlate(Event)
    .scalar_subquery()
)


def _event_query() -> Select:
    return select(Event, _active_count_sq.label("booked"))


def to_event_out(event: Event, booked: int, now: datetime | None = None) -> EventOut:
    now = now or _now()
    available = max(event.total_seats - booked, 0)
    return EventOut(
        id=event.id,
        title=event.title,
        description=event.description,
        starts_at=event.starts_at,
        venue=event.venue,
        total_seats=event.total_seats,
        booked_seats=booked,
        available_seats=available,
        is_full=available <= 0,
        is_past=event.starts_at <= now,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


def list_events(
    db: Session,
    *,
    page: int,
    page_size: int,
    search: str | None,
    include_past: bool = False,
) -> tuple[list[EventOut], int, int, int]:
    """
    Server-side filtered + paginated listing.

    Returns (items, total, page, total_pages). Page is clamped into range so a
    too-large page number simply returns the last page rather than an error.
    """
    page_size = max(1, min(page_size, MAX_PAGE_SIZE))
    now = _now()

    base = select(Event)
    if not include_past:
        base = base.where(Event.starts_at > now)
    if search:
        term = search.strip()[:100]
        if term:
            # ILIKE with a parameter - no string interpolation, no injection.
            base = base.where(Event.title.ilike(f"%{term}%"))

    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    total_pages = max(1, math.ceil(total / page_size))
    page = max(1, min(page, total_pages))

    rows = db.execute(
        _event_query()
        .where(Event.id.in_(select(base.subquery().c.id)))
        .order_by(Event.starts_at.asc(), Event.id.asc())  # stable ordering
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [to_event_out(ev, booked, now) for ev, booked in rows]
    return items, total, page, total_pages


def get_event(db: Session, event_id: int) -> EventOut:
    row = db.execute(_event_query().where(Event.id == event_id)).first()
    if not row:
        raise NotFoundError("Event not found", code="event_not_found")
    event, booked = row
    return to_event_out(event, booked)


# ---------------------------------------------------------------------------
# Admin operations
# ---------------------------------------------------------------------------

def create_event(db: Session, payload: EventCreate) -> EventOut:
    event = Event(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return to_event_out(event, 0)


def update_event(db: Session, event_id: int, payload: EventUpdate) -> EventOut:
    """
    Rule 8: capacity can't drop below the current number of active bookings.

    We lock the event row (SELECT ... FOR UPDATE) before counting, which is
    the same lock booking creation takes, so a concurrent booking can't slip
    in between our count and our update.
    """
    event = db.execute(
        select(Event).where(Event.id == event_id).with_for_update()
    ).scalar_one_or_none()
    if not event:
        raise NotFoundError("Event not found", code="event_not_found")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        booked = _count_active(db, event_id)
        return to_event_out(event, booked)

    booked = _count_active(db, event_id)
    new_capacity = changes.get("total_seats")
    if new_capacity is not None and new_capacity < booked:
        db.rollback()
        raise ConflictError(
            f"Cannot reduce capacity to {new_capacity}: {booked} seat(s) are already booked",
            code="capacity_below_bookings",
        )

    for field, value in changes.items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return to_event_out(event, booked)


def delete_event(db: Session, event_id: int) -> None:
    """
    Rule 9 (deletion policy): an event with *any* booking record - active or
    cancelled - cannot be deleted, so booking history is never orphaned.
    """
    event = db.get(Event, event_id)
    if not event:
        raise NotFoundError("Event not found", code="event_not_found")

    has_bookings = db.scalar(select(func.count(Booking.id)).where(Booking.event_id == event_id)) or 0
    if has_bookings:
        raise ConflictError(
            "This event has booking history and cannot be deleted",
            code="event_has_bookings",
        )
    db.delete(event)
    db.commit()


def list_attendees(db: Session, event_id: int) -> tuple[EventOut, list[AttendeeOut], int]:
    event_out = get_event(db, event_id)
    rows = db.execute(
        select(Booking, User)
        .join(User, User.id == Booking.user_id)
        .where(Booking.event_id == event_id)
        .order_by(Booking.status.asc(), Booking.created_at.asc())  # 'active' sorts before 'cancelled'
    ).all()
    attendees = [
        AttendeeOut(
            booking_id=b.id,
            user_id=u.id,
            name=u.name,
            email=u.email,
            status=b.status.value,
            booked_at=b.created_at,
            cancelled_at=b.cancelled_at,
        )
        for b, u in rows
    ]
    active = sum(1 for a in attendees if a.status == BookingStatus.active.value)
    return event_out, attendees, active


def _count_active(db: Session, event_id: int) -> int:
    return db.scalar(
        select(func.count(Booking.id)).where(
            Booking.event_id == event_id, Booking.status == BookingStatus.active
        )
    ) or 0
