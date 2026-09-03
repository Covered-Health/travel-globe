import hashlib
import hmac
import os
import secrets
from datetime import date
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pymongo import AsyncMongoClient, DESCENDING
from pydantic import BaseModel, EmailStr, Field

UPLOADS = Path("uploads")
UPLOADS.mkdir(exist_ok=True)
mongo = AsyncMongoClient(os.getenv("MONGODB_URL", "mongodb://localhost:27017"))


def get_collection():
    return mongo[os.getenv("MONGODB_DATABASE", "travel_globe")].locations


def get_users():
    return mongo[os.getenv("MONGODB_DATABASE", "travel_globe")].users


app = FastAPI(title="Travel Globe")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("WEB_ORIGIN", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=UPLOADS), name="uploads")


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
async def create_session(credentials: Credentials, response: Response, users=Depends(get_users)):
    email = str(credentials.email).lower()
    user = await users.find_one({"email": email})
    if user and not password_matches(credentials.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect password")
    token = secrets.token_urlsafe(32)
    session_hash = hashlib.sha256(token.encode()).hexdigest()
    if user:
        await users.update_one({"_id": user["_id"]}, {"$set": {"session_hash": session_hash}})
    else:
        await users.insert_one({"email": email, "password_hash": hash_password(credentials.password), "session_hash": session_hash})
    response.set_cookie("session", token, httponly=True, samesite="lax", max_age=30 * 24 * 60 * 60)
    return {"email": email}


async def get_current_user(request: Request, users=Depends(get_users)):
    token = request.cookies.get("session")
    if not token or not (user := await users.find_one({"session_hash": hashlib.sha256(token.encode()).hexdigest()})):
        raise HTTPException(401, "Login required")
    return user


@app.get("/api/session")
async def read_session(user=Depends(get_current_user)):
    return {"email": user["email"]}


def location_json(document):
    return {
        "id": str(document["_id"]),
        "name": document["name"],
        "latitude": document["latitude"],
        "longitude": document["longitude"],
        "timezone": document["timezone"],
        "startDate": document["start_date"].isoformat(),
        "endDate": document["end_date"].isoformat() if document["end_date"] else None,
        "story": document.get("story", document.get("note", "")),
        "photos": document["photos"],
        "embedPhotos": document.get("embed_photos", False),
    }


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
    collection=Depends(get_collection),
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
        if (isinstance(photo, str) and not photo) or (not isinstance(photo, str) and not photo.filename):
            continue
        if isinstance(photo, str):
            raise HTTPException(422, "Photos must be images")
        if not photo.content_type or not photo.content_type.startswith("image/"):
            raise HTTPException(422, "Photos must be images")
        content = await photo.read(10 * 1024 * 1024 + 1)
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(422, "Each photo must be 10 MB or smaller")
        filename = f"{uuid4().hex}{Path(photo.filename or '').suffix.lower()}"
        pending_photos.append((filename, content))

    photo_urls = []
    for filename, content in pending_photos:
        (UPLOADS / filename).write_bytes(content)
        photo_urls.append(f"/uploads/{filename}")

    document = {
        "user_id": user["_id"],
        "name": name,
        "latitude": latitude,
        "longitude": longitude,
        "timezone": timezone,
        "start_date": start_date,
        "end_date": end_date,
        "story": story,
        "photos": photo_urls,
        "embed_photos": embed_photos,
    }
    await collection.insert_one(document)
    return location_json(document)


@app.get("/api/locations")
async def list_locations(scope: str = "current", collection=Depends(get_collection), user=Depends(get_current_user)):
    if scope not in {"current", "all"}:
        raise HTTPException(422, "Scope must be current or all")
    documents = await collection.find({"user_id": user["_id"]}).sort("start_date", DESCENDING).to_list()
    if scope == "current":
        today = date.today()
        documents = [
            item for item in documents
            if item["start_date"] <= today and (item["end_date"] is None or item["end_date"] >= today)
        ]
    return [location_json(item) for item in documents]
