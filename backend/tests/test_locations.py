from datetime import date

from fastapi.testclient import TestClient

from backend.app import app, get_collection


class MemoryCollection:
    def __init__(self):
        self.documents = []

    async def insert_one(self, document):
        document["_id"] = "location-1"
        self.documents.append(document)

    def find(self, _query):
        return MemoryCursor(self.documents)


class MemoryCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, _field, _direction):
        return self

    async def to_list(self):
        return self.documents


def test_created_location_is_retrievable():
    collection = MemoryCollection()
    app.dependency_overrides[get_collection] = lambda: collection
    client = TestClient(app)

    created = client.post(
        "/api/locations",
        data={
            "name": "Lisbon",
            "latitude": "38.7223",
            "longitude": "-9.1393",
            "timezone": "Europe/Lisbon",
            "start_date": "2026-09-03",
            "note": "Pastéis by the river",
        },
    )
    locations = client.get("/api/locations?scope=all")

    assert created.status_code == 201
    assert locations.json() == [{
        "id": "location-1",
        "name": "Lisbon",
        "latitude": 38.7223,
        "longitude": -9.1393,
        "timezone": "Europe/Lisbon",
        "startDate": "2026-09-03",
        "endDate": None,
        "note": "Pastéis by the river",
        "photos": [],
    }]
    app.dependency_overrides.clear()


def test_current_scope_excludes_past_locations():
    collection = MemoryCollection()
    collection.documents = [
        {"_id": "past", "name": "Rome", "latitude": 41.9, "longitude": 12.5,
         "timezone": "Europe/Rome", "start_date": date(2020, 1, 1),
         "end_date": date(2020, 1, 5), "note": "", "photos": []},
        {"_id": "current", "name": "Home", "latitude": 32.1, "longitude": 34.8,
         "timezone": "Asia/Jerusalem", "start_date": date.today(),
         "end_date": None, "note": "", "photos": []},
    ]
    app.dependency_overrides[get_collection] = lambda: collection

    response = TestClient(app).get("/api/locations?scope=current")

    assert [item["name"] for item in response.json()] == ["Home"]
    app.dependency_overrides.clear()
