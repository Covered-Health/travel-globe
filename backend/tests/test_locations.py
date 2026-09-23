from datetime import date

from backend.tests.conftest import add_place


def test_created_location_is_retrievable(alice):
    created = add_place(alice, "Lisbon", story="Pastéis by the river")
    assert created.status_code == 201
    assert alice.get("/api/locations?scope=all").json() == [created.json()]
    assert created.json()["story"] == "Pastéis by the river"
    assert created.json()["endDate"] is None


def test_current_scope_excludes_past_locations(alice):
    add_place(alice, "Rome", start_date="2020-01-01", end_date="2020-01-05")
    add_place(alice, "Home", start_date=date.today().isoformat())
    assert [item["name"] for item in alice.get("/api/locations?scope=current").json()] == ["Home"]


def test_photo_larger_than_ten_megabytes_is_rejected(alice):
    response = add_place(
        alice,
        "Lisbon",
        files={"photos": ("large.jpg", b"x" * (10 * 1024 * 1024 + 1), "image/jpeg")},
    )
    assert response.status_code == 422
    assert alice.get("/api/locations?scope=all").json() == []


def test_end_date_before_start_date_is_rejected(alice):
    response = add_place(alice, "Lisbon", end_date="2026-09-02")
    assert response.status_code == 422


def test_unknown_timezone_is_rejected(alice):
    response = add_place(alice, "Lisbon", timezone="Mars/Olympus_Mons")
    assert response.status_code == 422


def test_non_image_upload_is_rejected(alice):
    response = add_place(alice, "Lisbon", files={"photos": ("notes.txt", b"hello", "text/plain")})
    assert response.status_code == 422


def test_unknown_scope_is_rejected(alice):
    assert alice.get("/api/locations?scope=nearby").status_code == 422


def test_empty_browser_file_placeholder_is_treated_as_no_photo(alice):
    response = add_place(alice, "Lisbon", files={"photos": ("", b"", "application/octet-stream")})
    assert response.status_code == 201
    assert response.json()["photos"] == []


def test_gecko_empty_upload_is_treated_as_no_photo(alice):
    boundary = "geckoformboundary"
    fields = {"name": "Bellevue", "latitude": "47.61038", "longitude": "-122.20068", "timezone": "America/Los_Angeles", "start_date": "2026-08-13"}
    parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n' for name, value in fields.items()]
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="photos"; filename=""\r\nContent-Type: application/octet-stream\r\n\r\n\r\n')
    parts.append(f'--{boundary}--\r\n')
    response = alice.post("/api/locations", content="".join(parts).encode(), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    assert response.status_code == 201
    assert response.json()["photos"] == []


def test_story_markdown_and_photo_layout_choice_are_preserved(alice):
    response = add_place(alice, "Lisbon", story="A **bright** day", embed_photos="true")
    assert response.json()["story"] == "A **bright** day"
    assert response.json()["embedPhotos"] is True


def test_uploaded_photo_is_saved_and_served(alice):
    response = add_place(alice, "Lisbon", files={"photos": ("view.jpg", b"photo-bytes", "image/jpeg")})
    assert response.status_code == 201
    assert alice.get(response.json()["photos"][0]).content == b"photo-bytes"
