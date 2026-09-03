from fastapi.testclient import TestClient

from backend.app import app, get_users


class InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class MemoryUsers:
    def __init__(self):
        self.documents = []

    async def insert_one(self, document):
        document["_id"] = f"user-{len(self.documents) + 1}"
        self.documents.append(document)
        return InsertResult(document["_id"])

    async def find_one(self, query):
        return next((item for item in self.documents if all(item.get(key) == value for key, value in query.items())), None)

    async def update_one(self, query, update):
        document = await self.find_one(query)
        document.update(update["$set"])


def test_first_login_creates_user_session():
    users = MemoryUsers()
    app.dependency_overrides[get_users] = lambda: users

    response = TestClient(app).post(
        "/api/session", json={"email": "traveler@example.com", "password": "long-enough-password"}
    )

    assert response.status_code == 200
    assert response.json() == {"email": "traveler@example.com"}
    assert response.cookies.get("session")
    app.dependency_overrides.clear()


def test_returning_user_with_wrong_password_is_rejected():
    users = MemoryUsers()
    app.dependency_overrides[get_users] = lambda: users
    client = TestClient(app)
    client.post("/api/session", json={"email": "traveler@example.com", "password": "right-password"})

    response = client.post(
        "/api/session", json={"email": "traveler@example.com", "password": "wrong-password"}
    )

    assert response.status_code == 401
    app.dependency_overrides.clear()


def test_session_cookie_restores_logged_in_user():
    users = MemoryUsers()
    app.dependency_overrides[get_users] = lambda: users
    client = TestClient(app)
    client.post("/api/session", json={"email": "traveler@example.com", "password": "right-password"})

    response = client.get("/api/session")

    assert response.json() == {"email": "traveler@example.com"}
    app.dependency_overrides.clear()
