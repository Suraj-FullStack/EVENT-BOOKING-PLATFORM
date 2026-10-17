from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.booking import BookingListResponse, BookingOut
from app.services import booking_service

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("/me", response_model=BookingListResponse)
def my_bookings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bookings = booking_service.list_user_bookings(db, user)
    return BookingListResponse(items=[booking_service.to_booking_out(b) for b in bookings])


@router.delete("/{booking_id}", response_model=BookingOut)
def cancel_booking(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Soft-cancel: the row is kept with status=cancelled for history."""
    booking = booking_service.cancel_booking(db, user, booking_id)
    return booking_service.to_booking_out(booking)
