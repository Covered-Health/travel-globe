import sqlite3

from fastapi.testclient import TestClient

from backend.app import app, hash_password


def test_login_and_location_survive_new_client_with_same_sqlite_file(tmp_path, monkeypatch):
    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "travel.sqlite3"))
    with TestClient(app) as first:
        assert first.post("/api/session", json={
            "email": "alice@example.com", "password": "long-password",
            "first_name": "Alice", "last_name": "Atlas",
        }).status_code == 200
        created = first.post("/api/locations", data={
            "name": "Lisbon, Portugal", "latitude": "38.7", "longitude": "-9.1",
            "timezone": "Europe/Lisbon", "start_date": "2026-09-03",
        })

    with TestClient(app) as second:
        assert second.post("/api/session", json={"email": "alice@example.com", "password": "long-password"}).status_code == 200
        assert second.get("/api/locations?scope=all").json() == [created.json()]


def test_health_check_confirms_sqlite_is_reachable(tmp_path, monkeypatch):
    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "travel.sqlite3"))
    with TestClient(app) as client:
        assert client.get("/healthz").json() == {"ok": True}


def test_existing_account_can_add_its_name_after_schema_upgrade(tmp_path, monkeypatch):
    path = tmp_path / "travel.sqlite3"
    monkeypatch.setenv("SQLITE_PATH", str(path))
    with sqlite3.connect(path) as db:
        db.execute("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, session_hash TEXT UNIQUE)")
        db.execute("INSERT INTO users VALUES (?, ?, ?, NULL)", ("legacy", "legacy@example.com", hash_password("legacy-password")))

    with TestClient(app) as client:
        response = client.post("/api/session", json={
            "email": "legacy@example.com", "password": "legacy-password",
            "first_name": "Legacy", "last_name": "Traveler",
        })

    assert response.json() == {"email": "legacy@example.com", "name": "Legacy Traveler"}
