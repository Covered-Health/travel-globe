from datetime import date

from fastapi.testclient import TestClient

from backend.app import app, get_collection, get_current_user


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
    app.dependency_overrides[get_current_user] = lambda: {"_id": "user-1"}
    client = TestClient(app)

    created = client.post(
        "/api/locations",
        data={
            "name": "Lisbon",
            "latitude": "38.7223",
            "longitude": "-9.1393",
            "timezone": "Europe/Lisbon",
            "start_date": "2026-09-03",
            "story": "Pastéis by the river",
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
        "story": "Pastéis by the river",
        "photos": [],
        "embedPhotos": False,
    }]
    app.dependency_overrides.clear()


def test_current_scope_excludes_past_locations():
    collection = MemoryCollection()
    collection.documents = [
        {"_id": "past", "name": "Rome", "latitude": 41.9, "longitude": 12.5,
         "timezone": "Europe/Rome", "start_date": date(2020, 1, 1),
         "end_date": date(2020, 1, 5), "story": "", "photos": [], "embed_photos": False},
        {"_id": "current", "name": "Home", "latitude": 32.1, "longitude": 34.8,
         "timezone": "Asia/Jerusalem", "start_date": date.today(),
         "end_date": None, "story": "", "photos": [], "embed_photos": False},
    ]
    app.dependency_overrides[get_collection] = lambda: collection
    app.dependency_overrides[get_current_user] = lambda: {"_id": "user-1"}

    response = TestClient(app).get("/api/locations?scope=current")

    assert [item["name"] for item in response.json()] == ["Home"]
    app.dependency_overrides.clear()


def test_photo_larger_than_ten_megabytes_is_rejected():
    collection = MemoryCollection()
    app.dependency_overrides[get_collection] = lambda: collection
    app.dependency_overrides[get_current_user] = lambda: {"_id": "user-1"}

    response = TestClient(app).post(
        "/api/locations",
        data={"name": "Lisbon", "latitude": "38.7", "longitude": "-9.1",
              "timezone": "Europe/Lisbon", "start_date": "2026-09-03"},
        files={"photos": ("large.jpg", b"x" * (10 * 1024 * 1024 + 1), "image/jpeg")},
    )

    assert response.status_code == 422
    app.dependency_overrides.clear()


def test_empty_browser_file_placeholder_is_treated_as_no_photo():
    collection = MemoryCollection()
    app.dependency_overrides[get_collection] = lambda: collection
    app.dependency_overrides[get_current_user] = lambda: {"_id": "user-1"}

    response = TestClient(app).post(
        "/api/locations",
        data={"name": "Lisbon", "latitude": "38.7", "longitude": "-9.1",
              "timezone": "Europe/Lisbon", "start_date": "2026-09-03"},
        files={"photos": ("", b"", "application/octet-stream")},
    )

    assert response.status_code == 201
    assert response.json()["photos"] == []
    app.dependency_overrides.clear()


def test_story_markdown_and_photo_layout_choice_are_preserved():
    collection = MemoryCollection()
    app.dependency_overrides[get_collection] = lambda: collection
    app.dependency_overrides[get_current_user] = lambda: {"_id": "user-1"}

    response = TestClient(app).post(
        "/api/locations",
        data={"name": "Lisbon", "latitude": "38.7", "longitude": "-9.1",
              "timezone": "Europe/Lisbon", "start_date": "2026-09-03",
              "story": "A **bright** day", "embed_photos": "true"},
    )

    assert response.json()["story"] == "A **bright** day"
    assert response.json()["embedPhotos"] is True
    app.dependency_overrides.clear()
