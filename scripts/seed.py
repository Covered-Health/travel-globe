#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["cyclopts>=4", "httpx>=0.28"]
# ///

from datetime import date, timedelta
from random import Random
from typing import Annotated

import httpx
from cyclopts import App, Parameter, validators


app = App(help="Add demo travel data to a running Travel Globe API.")
Positive = Annotated[int, Parameter(validator=validators.Number(gte=1))]
PLACES = [
    ("Lisbon, Portugal", 38.72, -9.14, "Europe/Lisbon"),
    ("Kyoto, Japan", 35.01, 135.77, "Asia/Tokyo"),
    ("Reykjavík, Iceland", 64.15, -21.94, "Atlantic/Reykjavik"),
    ("Cape Town, South Africa", -33.92, 18.42, "Africa/Johannesburg"),
    ("Buenos Aires, Argentina", -34.60, -58.38, "America/Argentina/Buenos_Aires"),
    ("Vancouver, Canada", 49.28, -123.12, "America/Vancouver"),
    ("Marrakesh, Morocco", 31.63, -8.00, "Africa/Casablanca"),
    ("Melbourne, Australia", -37.81, 144.96, "Australia/Melbourne"),
]


@app.default
def main(*, points: Positive, users: Positive, url: str = "http://localhost:8000", seed: int = 1):
    """Create POINTS locations distributed across USERS demo accounts."""
    rng = Random(seed)
    clients = [httpx.Client(base_url=url.rstrip("/")) for _ in range(users)]
    try:
        for number, client in enumerate(clients, 1):
            client.post("/api/session", json={"email": f"traveler{number}@example.com", "password": "travel-globe-demo"}).raise_for_status()
        for number in range(points):
            name, latitude, longitude, timezone = PLACES[number % len(PLACES)]
            start = date.today() - timedelta(days=rng.randrange(30, 1_800))
            clients[number % users].post("/api/locations", data={
                "name": name,
                "latitude": latitude + rng.uniform(-0.02, 0.02),
                "longitude": longitude + rng.uniform(-0.02, 0.02),
                "timezone": timezone,
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(days=rng.randrange(2, 15))).isoformat(),
                "story": f"A few memorable days exploring {name.split(',')[0]}.",
                "embed_photos": rng.choice(("true", "false")),
            }).raise_for_status()
    finally:
        for client in clients:
            client.close()
    print(f"Created {points} locations for {users} users at {url.rstrip('/')}.")


if __name__ == "__main__":
    app()
