from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _ensure_aware(dt: datetime) -> datetime:
    """Accept naive datetimes as UTC so comparisons are always tz-aware."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class EventBase(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=1, max_length=5000)
    starts_at: datetime
    venue: str = Field(min_length=2, max_length=200)
    total_seats: int = Field(ge=1, le=100_000)

    @field_validator("title", "venue", "description")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be blank")
        return v

    @field_validator("starts_at")
    @classmethod
    def _aware(cls, v: datetime) -> datetime:
        return _ensure_aware(v)


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    """All fields optional - PATCH semantics."""
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=5000)
    starts_at: datetime | None = None
    venue: str | None = Field(default=None, min_length=2, max_length=200)
    total_seats: int | None = Field(default=None, ge=1, le=100_000)

    @field_validator("title", "venue", "description")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be blank")
        return v

    @field_validator("starts_at")
    @classmethod
    def _aware(cls, v: datetime | None) -> datetime | None:
        return _ensure_aware(v) if v else v


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    starts_at: datetime
    venue: str
    total_seats: int
    # Derived fields, computed in SQL: total_seats - active bookings.
    booked_seats: int
    available_seats: int
    is_full: bool
    is_past: bool
    created_at: datetime
    updated_at: datetime


class EventListResponse(BaseModel):
    items: list[EventOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class AttendeeOut(BaseModel):
    booking_id: int
    user_id: int
    name: str
    email: str
    status: str
    booked_at: datetime
    cancelled_at: datetime | None


class AttendeeListResponse(BaseModel):
    event: EventOut
    attendees: list[AttendeeOut]
    active_count: int
