from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint("total_seats >= 1", name="ck_events_total_seats_positive"),
        # Listing is ordered by (starts_at, id) so this index covers it.
        Index("ix_events_starts_at_id", "starts_at", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # Always timezone-aware (timestamptz). The API accepts/returns ISO 8601 with offsets.
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    venue: Mapped[str] = mapped_column(String(200), nullable=False)
    total_seats: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    bookings: Mapped[list["Booking"]] = relationship(back_populates="event")  # noqa: F821
