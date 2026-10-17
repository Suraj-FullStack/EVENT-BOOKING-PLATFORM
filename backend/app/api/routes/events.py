"""Public event endpoints + the user-facing booking creation endpoint."""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.booking import BookingOut
from app.schemas.event import EventListResponse, EventOut
from app.services import booking_service, event_service

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=EventListResponse)
def list_events(
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(9, ge=1, le=event_service.MAX_PAGE_SIZE),
    search: str | None = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    items, total, page, total_pages = event_service.list_events(
        db, page=page, page_size=page_size, search=search
    )
    return EventListResponse(
        items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
    )


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db)):
    return event_service.get_event(db, event_id)


@router.post("/{event_id}/bookings", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def book_event(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = booking_service.create_booking(db, user, event_id)
    return booking_service.to_booking_out(booking)
