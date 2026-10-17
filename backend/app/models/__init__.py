"""
ORM models.

Importing them all here means `Base.metadata` knows about every table, which
is what Alembic autogenerate and `create_all` (used in tests) rely on.
"""
from app.models.user import User, UserRole
from app.models.event import Event
from app.models.booking import Booking, BookingStatus

__all__ = ["User", "UserRole", "Event", "Booking", "BookingStatus"]
