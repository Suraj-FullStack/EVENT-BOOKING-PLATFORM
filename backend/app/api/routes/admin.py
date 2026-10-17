"""Admin-only event management. Every route depends on `get_current_admin`."""
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models import User
from app.schemas.event import (
    AttendeeListResponse,
    EventCreate,
    EventListResponse,
    EventOut,
    EventUpdate,
)
from app.services import event_service

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_admin)],
)


@router.get("/events", response_model=EventListResponse)
def admin_list_events(
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(10, ge=1, le=event_service.MAX_PAGE_SIZE),
    search: str | None = Query(None, max_length=100),
    include_past: bool = Query(True),
    db: Session = Depends(get_db),
):
    items, total, page, total_pages = event_service.list_events(
        db, page=page, page_size=page_size, search=search, include_past=include_past
    )
    return EventListResponse(
        items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
    )


@router.post("/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def admin_create_event(payload: EventCreate, db: Session = Depends(get_db)):
    return event_service.create_event(db, payload)


@router.patch("/events/{event_id}", response_model=EventOut)
def admin_update_event(event_id: int, payload: EventUpdate, db: Session = Depends(get_db)):
    return event_service.update_event(db, event_id, payload)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_event(event_id: int, db: Session = Depends(get_db)):
    event_service.delete_event(db, event_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/events/{event_id}/attendees", response_model=AttendeeListResponse)
def admin_event_attendees(event_id: int, db: Session = Depends(get_db)):
    event, attendees, active = event_service.list_attendees(db, event_id)
    return AttendeeListResponse(event=event, attendees=attendees, active_count=active)
