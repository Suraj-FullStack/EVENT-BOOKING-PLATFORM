"""
Booking creation and cancellation.

Concurrency strategy (Rule 2)
-----------------------------
Every booking runs inside one transaction that starts with
`SELECT ... FROM events WHERE id = ? FOR UPDATE`. PostgreSQL serialises all
writers on that event row, so two requests for the last seat line up: the
second one waits, then re-counts and sees the event is full. Cancellation and
capacity updates take the same lock so the count it reads is always current.

On top of that, a partial unique index on (user_id, event_id) WHERE status =
'active' guarantees Rule 1 even if some future code path forgets the lock.
"""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import AppError, ConflictError, ForbiddenError, NotFoundError
from app.models import Booking, BookingStatus, Event, User
from app.schemas.booking import BookingOut


def _now() -> datetime:
    return datetime.now(timezone.utc)


def to_booking_out(booking: Booking, now: datetime | None = None) -> BookingOut:
    now = now or _now()
    is_past = booking.event.starts_at <= now
    return BookingOut(
        id=booking.id,
        event_id=booking.event_id,
        status=booking.status,
        created_at=booking.created_at,
        cancelled_at=booking.cancelled_at,
        event=booking.event,
        is_past=is_past,
        can_cancel=booking.status == BookingStatus.active and not is_past,
    )


def create_booking(db: Session, user: User, event_id: int) -> Booking:
    now = _now()

    # Lock the event row for the rest of this transaction.
    event = db.execute(
        select(Event).where(Event.id == event_id).with_for_update()
    ).scalar_one_or_none()
    if not event:
        raise NotFoundError("Event not found", code="event_not_found")

    # Rule 3
    if event.starts_at <= now:
        db.rollback()
        raise AppError("This event has already started", code="event_in_past")

    # Rule 1 (also enforced by the partial unique index)
    existing = db.scalar(
        select(Booking.id).where(
            Booking.user_id == user.id,
            Booking.event_id == event_id,
            Booking.status == BookingStatus.active,
        )
    )
    if existing:
        db.rollback()
        raise ConflictError("You already have an active booking for this event", code="already_booked")

    # Rule 2 - count under the lock
    active = db.scalar(
        select(func.count(Booking.id)).where(
            Booking.event_id == event_id, Booking.status == BookingStatus.active
        )
    ) or 0
    if active >= event.total_seats:
        db.rollback()
        raise ConflictError("This event is sold out", code="event_full")

    booking = Booking(user_id=user.id, event_id=event_id, status=BookingStatus.active)
    db.add(booking)
    try:
        db.commit()  # releases the row lock
    except IntegrityError:
        db.rollback()
        raise ConflictError("You already have an active booking for this event", code="already_booked")

    db.refresh(booking)
    booking.event = event
    return booking


def list_user_bookings(db: Session, user: User) -> list[Booking]:
    return list(
        db.scalars(
            select(Booking)
            .options(selectinload(Booking.event))
            .where(Booking.user_id == user.id)
            .order_by(Booking.created_at.desc(), Booking.id.desc())
        ).all()
    )


def cancel_booking(db: Session, user: User, booking_id: int) -> Booking:
    now = _now()

    booking = db.execute(
        select(Booking).where(Booking.id == booking_id).with_for_update()
    ).scalar_one_or_none()
    if not booking:
        raise NotFoundError("Booking not found", code="booking_not_found")

    # Rule 5 - ownership comes from the authenticated user, never the body.
    # We return 403 rather than 404 here; the spec asks for 403 on
    # insufficient permissions and the booking ids aren't sensitive.
    if booking.user_id != user.id:
        db.rollback()
        raise ForbiddenError("You can only cancel your own bookings", code="not_owner")

    if booking.status == BookingStatus.cancelled:
        db.rollback()
        raise AppError("This booking is already cancelled", code="already_cancelled")

    # Lock the event too so the seat count stays consistent with concurrent
    # bookings / capacity edits.
    event = db.execute(
        select(Event).where(Event.id == booking.event_id).with_for_update()
    ).scalar_one()

    # Rule 4
    if event.starts_at <= now:
        db.rollback()
        raise AppError("Bookings for past events cannot be cancelled", code="event_in_past")

    # Rule 6 - flipping the status is what frees the seat, since availability
    # is computed from active bookings.
    booking.status = BookingStatus.cancelled
    booking.cancelled_at = now
    db.commit()
    db.refresh(booking)
    booking.event = event
    return booking
