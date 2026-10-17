"""Public listing/pagination plus rules 7-9 (admin management)."""
from datetime import datetime, timedelta, timezone

from app.models import Event
from tests.conftest import make_booking, make_event


def _payload(**overrides):
    base = {
        "title": "Brand New Event",
        "description": "Something fun",
        "starts_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
        "venue": "Main Hall",
        "total_seats": 25,
    }
    base.update(overrides)
    return base


# Public listing ---------------------------------------------------------------
def test_listing_paginates_searches_and_hides_past(client, db):
    for i in range(12):
        make_event(db, title=f"Upcoming {i:02d}", days_from_now=i + 1)
    make_event(db, title="Old news", days_from_now=-3)

    page1 = client.get("/api/events?page=1&page_size=5").json()
    assert page1["total"] == 12
    assert page1["total_pages"] == 3
    assert len(page1["items"]) == 5
    assert page1["items"][0]["title"] == "Upcoming 00"  # ordered by starts_at

    page3 = client.get("/api/events?page=3&page_size=5").json()
    assert len(page3["items"]) == 2

    # Out-of-range page clamps to the last page rather than erroring
    clamped = client.get("/api/events?page=50&page_size=5").json()
    assert clamped["page"] == 3

    # case-insensitive substring match: "Upcoming 10" and "Upcoming 11"
    search = client.get("/api/events?search=UPCOMING 1").json()
    assert search["total"] == 2
    assert {e["title"] for e in search["items"]} == {"Upcoming 10", "Upcoming 11"}

    assert client.get("/api/events?page=0").status_code == 422
    assert client.get("/api/events?page_size=999").status_code == 422


def test_event_detail_404(client):
    res = client.get("/api/events/4242")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "event_not_found"


# Rule 7 -----------------------------------------------------------------------
def test_admin_endpoints_reject_normal_users_and_anonymous(client, db, user_headers):
    event = make_event(db)
    assert client.post("/api/admin/events", json=_payload(), headers=user_headers).status_code == 403
    assert client.patch(f"/api/admin/events/{event.id}", json={"title": "x"}, headers=user_headers).status_code == 403
    assert client.delete(f"/api/admin/events/{event.id}", headers=user_headers).status_code == 403
    assert client.get(f"/api/admin/events/{event.id}/attendees", headers=user_headers).status_code == 403
    assert client.get("/api/admin/events", headers=user_headers).status_code == 403
    assert client.get("/api/admin/events").status_code == 401


def test_admin_can_create_edit_and_view_attendees(client, db, user, admin_headers):
    created = client.post("/api/admin/events", json=_payload(), headers=admin_headers)
    assert created.status_code == 201
    event_id = created.json()["id"]
    assert created.json()["available_seats"] == 25

    edited = client.patch(f"/api/admin/events/{event_id}", json={"title": "Renamed", "total_seats": 30}, headers=admin_headers)
    assert edited.status_code == 200
    assert edited.json()["title"] == "Renamed"
    assert edited.json()["total_seats"] == 30

    make_booking(db, user, db.get(Event, event_id))
    att = client.get(f"/api/admin/events/{event_id}/attendees", headers=admin_headers)
    assert att.status_code == 200
    assert att.json()["active_count"] == 1
    assert att.json()["attendees"][0]["email"] == user.email


def test_admin_create_validation(client, admin_headers):
    assert client.post("/api/admin/events", json=_payload(total_seats=0), headers=admin_headers).status_code == 422
    assert client.post("/api/admin/events", json=_payload(title="  "), headers=admin_headers).status_code == 422
    assert client.post("/api/admin/events", json=_payload(starts_at="not-a-date"), headers=admin_headers).status_code == 422


# Rule 8 -----------------------------------------------------------------------
def test_cannot_reduce_capacity_below_active_bookings(client, db, user, other_user, admin_headers):
    event = make_event(db, seats=10)
    make_booking(db, user, event)
    make_booking(db, other_user, event)

    res = client.patch(f"/api/admin/events/{event.id}", json={"total_seats": 1}, headers=admin_headers)
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "capacity_below_bookings"

    ok = client.patch(f"/api/admin/events/{event.id}", json={"total_seats": 2}, headers=admin_headers)
    assert ok.status_code == 200
    assert ok.json()["available_seats"] == 0


# Rule 9 -----------------------------------------------------------------------
def test_delete_policy(client, db, user, admin_headers):
    empty = make_event(db, title="Empty")
    booked = make_event(db, title="Booked")
    make_booking(db, user, booked)

    assert client.delete(f"/api/admin/events/{empty.id}", headers=admin_headers).status_code == 204
    assert client.get(f"/api/events/{empty.id}").status_code == 404

    res = client.delete(f"/api/admin/events/{booked.id}", headers=admin_headers)
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "event_has_bookings"
