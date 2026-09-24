from fastapi.testclient import TestClient

from backend.app import app


def test_first_login_creates_user_session(client):
    response = client.post("/api/session", json={
        "email": "traveler@example.com", "password": "long-enough-password",
        "first_name": "Tara", "last_name": "Veler",
    })
    assert response.status_code == 200
    assert response.json() == {"email": "traveler@example.com", "name": "Tara Veler"}
    assert response.cookies.get("session")


def test_first_login_requires_a_name(client):
    response = client.post("/api/session", json={"email": "traveler@example.com", "password": "long-enough-password"})
    assert response.status_code == 422


def test_returning_user_with_wrong_password_is_rejected(alice):
    assert alice.post("/api/session", json={"email": "alice@example.com", "password": "wrong-password"}).status_code == 401


def test_session_cookie_restores_logged_in_user(alice):
    assert alice.get("/api/session").json() == {"email": "alice@example.com", "name": "Alice Atlas"}


def test_session_cookie_can_be_limited_to_https(client, monkeypatch):
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "true")
    response = client.post("/api/session", json={
        "email": "secure@example.com", "password": "long-enough-password",
        "first_name": "Secure", "last_name": "Traveler",
    })
    assert "secure" in response.headers["set-cookie"].lower()


def test_sign_out_revokes_session_cookie(alice):
    old_cookie = alice.cookies.get("session")

    response = alice.delete("/api/session")

    assert response.status_code == 204
    assert alice.get("/api/session").status_code == 401
    with TestClient(app, headers={"cookie": f"session={old_cookie}"}) as old_session:
        assert old_session.get("/api/session").status_code == 401


def test_anonymous_visitor_cannot_read_locations(client):
    assert client.get("/api/locations").status_code == 401
