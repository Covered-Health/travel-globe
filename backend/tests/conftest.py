import pytest
from fastapi.testclient import TestClient

from backend.app import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "travel.sqlite3"))
    monkeypatch.setenv("UPLOADS_PATH", str(tmp_path / "uploads"))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def alice(client):
    assert client.post("/api/session", json={"email": "alice@example.com", "password": "alice-password"}).status_code == 200
    return client


@pytest.fixture
def bob(client):
    with TestClient(app) as test_client:
        assert test_client.post("/api/session", json={"email": "bob@example.com", "password": "bobby-password"}).status_code == 200
        yield test_client


def add_place(client, name, files=None, **fields):
    return client.post(
        "/api/locations",
        data={
            "name": name, "latitude": "38.7", "longitude": "-9.1",
            "timezone": "Europe/Lisbon", "start_date": "2026-09-03", **fields,
        },
        files=files,
    )
