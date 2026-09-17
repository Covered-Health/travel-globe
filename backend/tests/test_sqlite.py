from fastapi.testclient import TestClient

from backend.app import app


def test_login_and_location_survive_new_client_with_same_sqlite_file(tmp_path, monkeypatch):
    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "travel.sqlite3"))
    first = TestClient(app)
    assert first.post("/api/session", json={"email": "alice@example.com", "password": "long-password"}).status_code == 200
    created = first.post("/api/locations", data={
        "name": "Lisbon, Portugal", "latitude": "38.7", "longitude": "-9.1",
        "timezone": "Europe/Lisbon", "start_date": "2026-09-03",
    })

    second = TestClient(app)
    assert second.post("/api/session", json={"email": "alice@example.com", "password": "long-password"}).status_code == 200
    assert second.get("/api/locations?scope=all").json() == [created.json()]


def test_health_check_confirms_sqlite_is_writable(tmp_path, monkeypatch):
    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "travel.sqlite3"))
    assert TestClient(app).get("/healthz").json() == {"ok": True}
