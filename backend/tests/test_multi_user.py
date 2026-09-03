from fastapi.testclient import TestClient

from backend.app import app, get_collection, get_users
from backend.tests.test_session import MemoryUsers


class MemoryCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, _field, _direction):
        return self

    async def to_list(self):
        return self.documents


class MemoryLocations:
    def __init__(self):
        self.documents = []

    async def insert_one(self, document):
        document["_id"] = f"location-{len(self.documents) + 1}"
        self.documents.append(document)

    def find(self, query):
        return MemoryCursor([
            item for item in self.documents
            if all(item.get(key) == value for key, value in query.items())
        ])


def test_travelers_only_see_their_own_locations():
    users, locations = MemoryUsers(), MemoryLocations()
    app.dependency_overrides[get_users] = lambda: users
    app.dependency_overrides[get_collection] = lambda: locations
    alice, bob = TestClient(app), TestClient(app)
    alice.post("/api/session", json={"email": "alice@example.com", "password": "alice-password"})
    bob.post("/api/session", json={"email": "bob@example.com", "password": "bobby-password"})
    alice.post("/api/locations", data={
        "name": "Lisbon", "latitude": "38.7", "longitude": "-9.1",
        "timezone": "Europe/Lisbon", "start_date": "2026-09-03",
    })

    response = bob.get("/api/locations?scope=all")

    assert response.json() == []
    app.dependency_overrides.clear()
