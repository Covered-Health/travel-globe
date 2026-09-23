from backend.tests.conftest import add_place


def test_travelers_only_see_their_own_locations(alice, bob):
    add_place(alice, "Lisbon")
    assert bob.get("/api/locations?scope=all").json() == []


def test_shared_atlas_identifies_every_locations_traveler(alice, bob):
    add_place(alice, "Lisbon")
    add_place(bob, "Oslo")
    atlas = alice.get("/api/atlas?scope=all").json()
    assert {item["traveler"]["email"] for item in atlas} == {"alice@example.com", "bob@example.com"}


def test_traveler_details_include_their_locations(alice):
    add_place(alice, "Lisbon")
    user_id = alice.get("/api/atlas?scope=all").json()[0]["traveler"]["id"]
    response = alice.get(f"/api/users/{user_id}")
    assert response.json()["email"] == "alice@example.com"
    assert [item["name"] for item in response.json()["locations"]] == ["Lisbon"]


def test_location_details_identify_the_traveler(alice):
    location_id = add_place(alice, "Lisbon").json()["id"]
    assert alice.get(f"/api/locations/{location_id}").json()["traveler"]["email"] == "alice@example.com"
