"""Business rules 1-6: the heart of the assignment."""
import threading

from sqlalchemy import func, select

from app.models import Booking, BookingStatus
from tests.conftest import login, make_booking, make_event, make_user


def _active_count(db, event_id):
    return db.scalar(
        select(func.count(Booking.id)).where(Booking.event_id == event_id, Booking.status == BookingStatus.active)
    )


# Rule 1 ----------------------------------------------------------------------
def test_duplicate_active_booking_is_rejected(client, db, user, user_headers):
    event = make_event(db, seats=10)
    first = client.post(f"/api/events/{event.id}/bookings", headers=user_headers)
    assert first.status_code == 201

    second = client.post(f"/api/events/{event.id}/bookings", headers=user_headers)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "already_booked"
    assert _active_count(db, event.id) == 1


def test_can_rebook_after_cancelling(client, db, user, user_headers):
    event = make_event(db, seats=10)
    booking = client.post(f"/api/events/{event.id}/bookings", headers=user_headers).json()
    cancel = client.delete(f"/api/bookings/{booking['id']}", headers=user_headers)
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "cancelled"

    again = client.post(f"/api/events/{event.id}/bookings", headers=user_headers)
    assert again.status_code == 201
    # history kept: 1 cancelled + 1 active
    assert db.scalar(select(func.count(Booking.id)).where(Booking.event_id == event.id)) == 2


# Rule 2 ----------------------------------------------------------------------
def test_booking_full_event_is_rejected(client, db, user, other_user, user_headers):
    event = make_event(db, seats=1)
    make_booking(db, other_user, event)  # takes the only seat

    res = client.post(f"/api/events/{event.id}/bookings", headers=user_headers)
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "event_full"

    detail = client.get(f"/api/events/{event.id}").json()
    assert detail["available_seats"] == 0 and detail["is_full"] is True


def test_concurrent_bookings_never_exceed_capacity(client, db):
    """
    20 users race for 5 seats from separate threads (each gets its own DB
    connection through the TestClient). Exactly 5 must win.
    """
    seats = 5
    event = make_event(db, seats=seats)
    users = [make_user(db, email=f"racer{i}@test.dev") for i in range(20)]
    headers = [login(client, u.email) for u in users]

    results: list[int] = []
    lock = threading.Lock()
    barrier = threading.Barrier(len(users))

    def attempt(h):
        barrier.wait()  # start everyone at the same moment
        status = client.post(f"/api/events/{event.id}/bookings", headers=h).status_code
        with lock:
            results.append(status)

    threads = [threading.Thread(target=attempt, args=(h,)) for h in headers]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert results.count(201) == seats
    assert results.count(409) == len(users) - seats
    assert _active_count(db, event.id) == seats


# Rule 3 ----------------------------------------------------------------------
def test_booking_past_event_is_rejected(client, db, user_headers):
    event = make_event(db, days_from_now=-1)
    res = client.post(f"/api/events/{event.id}/bookings", headers=user_headers)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "event_in_past"


# Rule 4 ----------------------------------------------------------------------
def test_cancelling_past_event_booking_is_rejected(client, db, user, user_headers):
    event = make_event(db, days_from_now=-1)
    booking = make_booking(db, user, event)
    res = client.delete(f"/api/bookings/{booking.id}", headers=user_headers)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "event_in_past"


# Rule 5 ----------------------------------------------------------------------
def test_cannot_cancel_someone_elses_booking(client, db, user, other_user, other_headers):
    event = make_event(db)
    booking = make_booking(db, user, event)

    res = client.delete(f"/api/bookings/{booking.id}", headers=other_headers)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "not_owner"

    db.refresh(booking)
    assert booking.status == BookingStatus.active


# Rule 6 ----------------------------------------------------------------------
def test_cancellation_frees_a_seat(client, db, user, other_user, user_headers, other_headers):
    event = make_event(db, seats=1)
    booking = client.post(f"/api/events/{event.id}/bookings", headers=user_headers).json()
    assert client.post(f"/api/events/{event.id}/bookings", headers=other_headers).status_code == 409

    assert client.delete(f"/api/bookings/{booking['id']}", headers=user_headers).status_code == 200
    assert client.get(f"/api/events/{event.id}").json()["available_seats"] == 1

    assert client.post(f"/api/events/{event.id}/bookings", headers=other_headers).status_code == 201


# Misc ------------------------------------------------------------------------
def test_my_bookings_only_shows_own(client, db, user, other_user, user_headers):
    e1, e2 = make_event(db, title="Mine"), make_event(db, title="Theirs")
    make_booking(db, user, e1)
    make_booking(db, other_user, e2)

    res = client.get("/api/bookings/me", headers=user_headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert [b["event"]["title"] for b in items] == ["Mine"]
    assert items[0]["can_cancel"] is True


def test_booking_requires_auth(client, db):
    event = make_event(db)
    assert client.post(f"/api/events/{event.id}/bookings").status_code == 401


def test_booking_missing_event_is_404(client, user_headers):
    assert client.post("/api/events/99999/bookings", headers=user_headers).status_code == 404
