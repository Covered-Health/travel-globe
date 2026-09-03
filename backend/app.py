import os
from datetime import date
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pymongo import AsyncMongoClient, DESCENDING

UPLOADS = Path("uploads")
UPLOADS.mkdir(exist_ok=True)
mongo = AsyncMongoClient(os.getenv("MONGODB_URL", "mongodb://localhost:27017"))


def get_collection():
    return mongo[os.getenv("MONGODB_DATABASE", "travel_globe")].locations


app = FastAPI(title="Travel Globe")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("WEB_ORIGIN", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=UPLOADS), name="uploads")


def location_json(document):
    return {
        "id": str(document["_id"]),
        "name": document["name"],
        "latitude": document["latitude"],
        "longitude": document["longitude"],
        "timezone": document["timezone"],
        "startDate": document["start_date"].isoformat(),
        "endDate": document["end_date"].isoformat() if document["end_date"] else None,
        "note": document["note"],
        "photos": document["photos"],
    }


@app.post("/api/locations", status_code=201)
async def create_location(
    name: str = Form(min_length=1, max_length=120),
    latitude: float = Form(ge=-90, le=90),
    longitude: float = Form(ge=-180, le=180),
    timezone: str = Form(),
    start_date: date = Form(),
    end_date: date | None = Form(None),
    note: str = Form("", max_length=5000),
    photos: list[UploadFile] = File(default=[]),
    collection=Depends(get_collection),
):
    if end_date and end_date < start_date:
        raise HTTPException(422, "End date must not precede start date")
    try:
        ZoneInfo(timezone)
    except ZoneInfoNotFoundError:
        raise HTTPException(422, "Unknown timezone") from None

    photo_urls = []
    for photo in photos:
        if not photo.content_type or not photo.content_type.startswith("image/"):
            raise HTTPException(422, "Photos must be images")
        filename = f"{uuid4().hex}{Path(photo.filename or '').suffix.lower()}"
        (UPLOADS / filename).write_bytes(await photo.read())
        photo_urls.append(f"/uploads/{filename}")

    document = {
        "name": name,
        "latitude": latitude,
        "longitude": longitude,
        "timezone": timezone,
        "start_date": start_date,
        "end_date": end_date,
        "note": note,
        "photos": photo_urls,
    }
    await collection.insert_one(document)
    return location_json(document)


@app.get("/api/locations")
async def list_locations(scope: str = "current", collection=Depends(get_collection)):
    if scope not in {"current", "all"}:
        raise HTTPException(422, "Scope must be current or all")
    documents = await collection.find({}).sort("start_date", DESCENDING).to_list()
    if scope == "current":
        today = date.today()
        documents = [
            item for item in documents
            if item["start_date"] <= today and (item["end_date"] is None or item["end_date"] >= today)
        ]
    return [location_json(item) for item in documents]
