from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.booking import BookingStatus


class BookingEventSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    starts_at: datetime
    venue: str


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    status: BookingStatus
    created_at: datetime
    cancelled_at: datetime | None
    event: BookingEventSummary
    # Convenience flags so the UI doesn't need to re-implement the rules.
    is_past: bool
    can_cancel: bool


class BookingListResponse(BaseModel):
    items: list[BookingOut]
