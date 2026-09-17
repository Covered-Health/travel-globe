import pytest
from fastapi.testclient import TestClient

from backend.app import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "travel.sqlite3"))
    monkeypatch.setenv("UPLOADS_PATH", str(tmp_path / "uploads"))
    return TestClient(app)


@pytest.fixture
def alice(client):
    assert client.post("/api/session", json={"email": "alice@example.com", "password": "alice-password"}).status_code == 200
    return client


def add_place(client, name="Lisbon", **fields):
    return client.post("/api/locations", data={
        "name": name, "latitude": "38.7", "longitude": "-9.1",
        "timezone": "Europe/Lisbon", "start_date": "2026-09-03", **fields,
    })
