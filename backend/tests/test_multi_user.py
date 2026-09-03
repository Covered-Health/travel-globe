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

    async def find_one(self, query):
        return next((item for item in self.documents if all(item.get(key) == value for key, value in query.items())), None)


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


def test_shared_atlas_identifies_every_locations_traveler():
    users, locations = MemoryUsers(), MemoryLocations()
    app.dependency_overrides[get_users] = lambda: users
    app.dependency_overrides[get_collection] = lambda: locations
    alice, bob = TestClient(app), TestClient(app)
    alice.post("/api/session", json={"email": "alice@example.com", "password": "alice-password"})
    bob.post("/api/session", json={"email": "bob@example.com", "password": "bobby-password"})
    alice.post("/api/locations", data={"name": "Lisbon", "latitude": "38.7", "longitude": "-9.1", "timezone": "Europe/Lisbon", "start_date": "2026-09-03"})
    bob.post("/api/locations", data={"name": "Oslo", "latitude": "59.9", "longitude": "10.7", "timezone": "Europe/Oslo", "start_date": "2026-09-03"})

    response = alice.get("/api/atlas?scope=all")

    assert [(item["name"], item["traveler"]) for item in response.json()] == [
        ("Lisbon", {"id": "user-1", "email": "alice@example.com"}),
        ("Oslo", {"id": "user-2", "email": "bob@example.com"}),
    ]
    app.dependency_overrides.clear()


def test_traveler_details_include_their_locations():
    users, locations = MemoryUsers(), MemoryLocations()
    app.dependency_overrides[get_users] = lambda: users
    app.dependency_overrides[get_collection] = lambda: locations
    client = TestClient(app)
    client.post("/api/session", json={"email": "alice@example.com", "password": "alice-password"})
    client.post("/api/locations", data={"name": "Lisbon", "latitude": "38.7", "longitude": "-9.1", "timezone": "Europe/Lisbon", "start_date": "2026-09-03"})

    response = client.get("/api/users/user-1")

    assert response.json()["email"] == "alice@example.com"
    assert [item["name"] for item in response.json()["locations"]] == ["Lisbon"]
    app.dependency_overrides.clear()


def test_location_details_identify_the_traveler():
    users, locations = MemoryUsers(), MemoryLocations()
    app.dependency_overrides[get_users] = lambda: users
    app.dependency_overrides[get_collection] = lambda: locations
    client = TestClient(app)
    client.post("/api/session", json={"email": "alice@example.com", "password": "alice-password"})
    client.post("/api/locations", data={"name": "Lisbon", "latitude": "38.7", "longitude": "-9.1", "timezone": "Europe/Lisbon", "start_date": "2026-09-03"})

    response = client.get("/api/locations/location-1")

    assert response.json()["traveler"] == {"id": "user-1", "email": "alice@example.com"}
    app.dependency_overrides.clear()
