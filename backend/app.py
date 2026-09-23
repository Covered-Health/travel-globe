import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import Literal
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field


def uploads_path():
    return Path(os.getenv("UPLOADS_PATH", "uploads"))


def secure_cookies():
    return os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"


MAX_PHOTO_BYTES = 10 * 1024 * 1024


def database_path():
    path = Path(os.getenv("SQLITE_PATH", "data/travel-globe.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def initialize_database():
    with sqlite3.connect(database_path()) as connection:
        connection.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL, session_hash TEXT UNIQUE
            );
            CREATE TABLE IF NOT EXISTS locations (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
                name TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL,
                timezone TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT,
                story TEXT NOT NULL, photos TEXT NOT NULL, embed_photos INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS locations_user_date ON locations(user_id, start_date DESC);
        """)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database()
    yield


def get_db():
    path = database_path()
    connection = sqlite3.connect(path, timeout=30, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    try:
        yield connection
    finally:
        connection.close()


app = FastAPI(title="Travel Globe", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("WEB_ORIGIN", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def health(db=Depends(get_db)):
    db.execute("SELECT 1")
    return {"ok": True}


@app.get("/uploads/{filename}")
def read_photo(filename: str):
    path = uploads_path() / filename
    if not path.is_file():
        raise HTTPException(404, "Photo not found")
    return FileResponse(path)


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}:{digest.hex()}"


def password_matches(password: str, encoded: str) -> bool:
    salt, expected = encoded.split(":", 1)
    actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1)
    return hmac.compare_digest(actual.hex(), expected)


@app.post("/api/session")
async def create_session(credentials: Credentials, response: Response, db=Depends(get_db)):
    email = str(credentials.email).lower()
    user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if user and not password_matches(credentials.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect password")
    token = secrets.token_urlsafe(32)
    session_hash = hashlib.sha256(token.encode()).hexdigest()
    if user:
        db.execute("UPDATE users SET session_hash=? WHERE id=?", (session_hash, user["id"]))
    else:
        db.execute(
            "INSERT INTO users (id, email, password_hash, session_hash) VALUES (?, ?, ?, ?)",
            (uuid4().hex, email, hash_password(credentials.password), session_hash),
        )
    db.commit()
    response.set_cookie(
        "session",
        token,
        httponly=True,
        secure=secure_cookies(),
        samesite="lax",
        max_age=30 * 24 * 60 * 60,
    )
    return {"email": email}


async def get_current_user(request: Request, db=Depends(get_db)):
    token = request.cookies.get("session")
    if not token or not (user := db.execute("SELECT * FROM users WHERE session_hash=?", (hashlib.sha256(token.encode()).hexdigest(),)).fetchone()):
        raise HTTPException(401, "Login required")
    return user


@app.get("/api/session")
async def read_session(user=Depends(get_current_user)):
    return {"email": user["email"]}


@app.delete("/api/session", status_code=204)
def delete_session(response: Response, db=Depends(get_db), user=Depends(get_current_user)):
    db.execute("UPDATE users SET session_hash=NULL WHERE id=?", (user["id"],))
    db.commit()
    response.delete_cookie("session", secure=secure_cookies(), samesite="lax")


def location_json(document, photos=None):
    return {
        "id": document["id"],
        "name": document["name"],
        "latitude": document["latitude"],
        "longitude": document["longitude"],
        "timezone": document["timezone"],
        "startDate": document["start_date"],
        "endDate": document["end_date"],
        "story": document["story"],
        "photos": photos if photos is not None else json.loads(document["photos"]),
        "embedPhotos": bool(document["embed_photos"]),
    }


def shared_location(document, db):
    owner = db.execute("SELECT id, email FROM users WHERE id=?", (document["user_id"],)).fetchone()
    item = location_json(document)
    item["traveler"] = {"id": owner["id"], "email": owner["email"]}
    return item


@app.post("/api/locations", status_code=201)
async def create_location(
    name: str = Form(min_length=1, max_length=120),
    latitude: float = Form(ge=-90, le=90),
    longitude: float = Form(ge=-180, le=180),
    timezone: str = Form(),
    start_date: date = Form(),
    end_date: date | None = Form(None),
    story: str = Form("", max_length=20_000),
    embed_photos: bool = Form(False),
    photos: list[UploadFile | str] = File(default=[]),
    db=Depends(get_db),
    user=Depends(get_current_user),
):
    if end_date and end_date < start_date:
        raise HTTPException(422, "End date must not precede start date")
    try:
        ZoneInfo(timezone)
    except ZoneInfoNotFoundError:
        raise HTTPException(422, "Unknown timezone") from None

    pending_photos = []
    for photo in photos:
        if isinstance(photo, str):
            if not photo:
                continue
            raise HTTPException(422, "Photos must be images")
        if not photo.filename:
            continue
        if not photo.content_type or not photo.content_type.startswith("image/"):
            raise HTTPException(422, "Photos must be images")
        content = await photo.read(MAX_PHOTO_BYTES + 1)
        if len(content) > MAX_PHOTO_BYTES:
            raise HTTPException(422, "Each photo must be 10 MB or smaller")
        filename = f"{uuid4().hex}{Path(photo.filename or '').suffix.lower()}"
        pending_photos.append((filename, content))

    photo_urls = []
    if pending_photos:
        uploads_path().mkdir(parents=True, exist_ok=True)
    for filename, content in pending_photos:
        (uploads_path() / filename).write_bytes(content)
        photo_urls.append(f"/uploads/{filename}")

    document = {
        "user_id": user["id"],
        "name": name,
        "latitude": latitude,
        "longitude": longitude,
        "timezone": timezone,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat() if end_date else None,
        "story": story,
        "photos": photo_urls,
        "embed_photos": embed_photos,
    }
    document["id"] = uuid4().hex
    db.execute(
        """INSERT INTO locations (
            id, user_id, name, latitude, longitude, timezone,
            start_date, end_date, story, photos, embed_photos
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            document["id"], document["user_id"], name, latitude, longitude, timezone,
            document["start_date"], document["end_date"], story, json.dumps(photo_urls), int(embed_photos),
        ),
    )
    db.commit()
    return location_json(document, photo_urls)


@app.get("/api/locations")
async def list_locations(scope: Literal["current", "all"] = "current", db=Depends(get_db), user=Depends(get_current_user)):
    query = "SELECT * FROM locations WHERE user_id=?"
    parameters = [user["id"]]
    if scope == "current":
        query += " AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)"
        parameters += [date.today().isoformat()] * 2
    documents = db.execute(f"{query} ORDER BY start_date DESC", parameters).fetchall()
    return [location_json(item) for item in documents]


@app.get("/api/atlas")
async def read_atlas(scope: Literal["current", "all"] = "current", db=Depends(get_db), _user=Depends(get_current_user)):
    query = "SELECT * FROM locations"
    parameters = []
    if scope == "current":
        query += " WHERE start_date <= ? AND (end_date IS NULL OR end_date >= ?)"
        parameters = [date.today().isoformat()] * 2
    documents = db.execute(f"{query} ORDER BY start_date DESC", parameters).fetchall()
    return [shared_location(document, db) for document in documents]


@app.get("/api/users/{user_id}")
async def read_user(user_id: str, db=Depends(get_db), _user=Depends(get_current_user)):
    owner = db.execute("SELECT id, email FROM users WHERE id=?", (user_id,)).fetchone()
    if not owner:
        raise HTTPException(404, "Traveler not found")
    documents = db.execute("SELECT * FROM locations WHERE user_id=? ORDER BY start_date DESC", (user_id,)).fetchall()
    return {"id": owner["id"], "email": owner["email"], "locations": [location_json(item) for item in documents]}


@app.get("/api/locations/{location_id}")
async def read_location(location_id: str, db=Depends(get_db), _user=Depends(get_current_user)):
    document = db.execute("SELECT * FROM locations WHERE id=?", (location_id,)).fetchone()
    if not document:
        raise HTTPException(404, "Location not found")
    return shared_location(document, db)


@app.get("/{path:path}", include_in_schema=False)
def read_web(path: str):
    root = Path(os.getenv("DIST_PATH", "dist"))
    asset = root / path
    if not asset.resolve().is_relative_to(root.resolve()):
        raise HTTPException(404, "Not found")
    if asset.is_file():
        return FileResponse(asset)
    if path and "." in Path(path).name:
        raise HTTPException(404, "Not found")
    index = root / "index.html"
    if not index.is_file():
        raise HTTPException(404, "Not found")
    return FileResponse(index)
