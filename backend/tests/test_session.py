def test_first_login_creates_user_session(client):
    response = client.post("/api/session", json={"email": "traveler@example.com", "password": "long-enough-password"})
    assert response.status_code == 200
    assert response.json() == {"email": "traveler@example.com"}
    assert response.cookies.get("session")


def test_returning_user_with_wrong_password_is_rejected(alice):
    assert alice.post("/api/session", json={"email": "alice@example.com", "password": "wrong-password"}).status_code == 401


def test_session_cookie_restores_logged_in_user(alice):
    assert alice.get("/api/session").json() == {"email": "alice@example.com"}


def test_sign_out_revokes_session_cookie(alice):
    old_cookie = alice.cookies.get("session")

    response = alice.delete("/api/session")

    assert response.status_code == 204
    assert alice.get("/api/session").status_code == 401
    assert TestClient(app, headers={"cookie": f"session={old_cookie}"}).get("/api/session").status_code == 401


def test_anonymous_visitor_cannot_read_locations(client):
    assert client.get("/api/locations").status_code == 401
from fastapi.testclient import TestClient

from backend.app import app
