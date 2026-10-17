from app.models import User


def test_register_login_me_logout_flow(client, db):
    res = client.post("/api/auth/register", json={
        "name": "New Person", "email": "New.Person@Test.dev", "password": "Password123!",
    })
    assert res.status_code == 201
    body = res.json()["user"]
    assert body["email"] == "new.person@test.dev"  # normalised
    assert body["role"] == "user"
    assert "password_hash" not in body
    assert "eventbook_access" in res.cookies

    # Cookie-based session works for /me when the cookie is sent
    client.cookies.set("eventbook_access", res.cookies["eventbook_access"])
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "new.person@test.dev"

    # Logout clears cookie
    out = client.post("/api/auth/logout", headers={"X-Requested-With": "XMLHttpRequest"})
    assert out.status_code == 200


def test_register_ignores_client_supplied_role(client, db):
    res = client.post("/api/auth/register", json={
        "name": "Sneaky", "email": "sneaky@test.dev", "password": "Password123!", "role": "admin",
    })
    assert res.status_code == 201
    assert res.json()["user"]["role"] == "user"
    assert db.query(User).filter_by(email="sneaky@test.dev").one().role.value == "user"


def test_duplicate_email_is_conflict(client, user):
    res = client.post("/api/auth/register", json={
        "name": "Dup", "email": user.email, "password": "Password123!",
    })
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "email_taken"


def test_wrong_password_is_401(client, user):
    res = client.post("/api/auth/login", json={"email": user.email, "password": "nope-nope-nope"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "invalid_credentials"


def test_me_requires_auth(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_validation_error_shape(client):
    res = client.post("/api/auth/register", json={"name": "x", "email": "bad", "password": "short"})
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "validation_error"
    fields = {d["field"] for d in err["details"]}
    assert {"name", "email", "password"} <= fields


def test_cookie_post_without_csrf_header_is_rejected(client, db, user):
    res = client.post("/api/auth/login", json={"email": user.email, "password": "Password123!"})
    client.cookies.set("eventbook_access", res.cookies["eventbook_access"])
    # No X-Requested-With and no Bearer -> blocked
    res = client.post("/api/auth/logout")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "csrf_rejected"
