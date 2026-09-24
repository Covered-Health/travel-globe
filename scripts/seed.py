#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["cyclopts>=4", "geonamescache==3.0.2", "httpx>=0.28"]
# ///

from datetime import date, timedelta
from random import Random
from typing import Annotated

import httpx
from cyclopts import App, Parameter, validators
from geonamescache import GeonamesCache


app = App(help="Add demo travel data to a running Travel Globe API.")
Positive = Annotated[int, Parameter(validator=validators.Number(gte=1))]
FIRST_NAMES = """Amina Arjun Ava Camila Daniel Diego Elena Elias Emma Farah Felix Hana Hugo Ines
Jack Jia Kai Layla Leo Lucia Maya Mateo Mina Nadia Noah Noura Omar Priya Ravi Sofia Theo Yara Zane""".split()
LAST_NAMES = """Alvarez Andersson Bennett Chen Costa Dubois Fischer Garcia Haddad Ibrahim Ivanov
Jensen Kim Kowalski Kumar Laurent Martin Mensah Mori Mueller Nakamura Novak Okafor Patel Petrov Rossi
Santos Silva Singh Smith Tanaka Thompson Torres Wang Williams Yilmaz""".split()
DOMAINS = ["example.com", "example.net", "example.org"]
GEONAMES = GeonamesCache()
COUNTRIES = GEONAMES.get_countries()
CITIES = list(GEONAMES.get_cities().values())
ACTIVITIES = [
    "wandering through local markets", "trying neighborhood cafés", "hiking beyond the city",
    "visiting tiny museums", "taking the slow train", "watching the evening light",
    "finding the best street food", "getting pleasantly lost", "meeting old friends",
    "photographing the architecture", "reading beside the water", "following live music",
]
STORIES = [
    "Spent {days} days {activity} in {city}.",
    "A return to {city}: {activity}, with no real itinerary.",
    "The highlight of {city} was {activity}.",
    "Came to {city} for a few days and stayed for {days}.",
    "Mostly remember {activity} and one excellent late dinner in {city}.",
]


@app.default
def main(*, points: Positive, users: Positive, url: str = "http://localhost:8000", random_seed: int = 4815162342):
    """Create POINTS locations distributed across USERS demo accounts."""
    rng = Random(random_seed)
    clients = [httpx.Client(base_url=url.rstrip("/")) for _ in range(users)]
    try:
        for number, client in enumerate(clients, 1):
            first_name, last_name, domain = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES), rng.choice(DOMAINS)
            client.post("/api/session", json={
                "email": f"{first_name}.{last_name}.{number}@{domain}".lower(),
                "password": "travel-globe-demo", "first_name": first_name, "last_name": last_name,
            }).raise_for_status()
        for number in range(points):
            city = rng.choice(CITIES)
            name = f"{city['name']}, {COUNTRIES[city['countrycode']]['name']}"
            start = date.today() - timedelta(days=rng.randrange(10, 3_000))
            days = rng.randrange(2, 31)
            owner = number if number < users else rng.randrange(users)
            clients[owner].post("/api/locations", data={
                "name": name,
                "latitude": city["latitude"],
                "longitude": city["longitude"],
                "timezone": city["timezone"],
                "start_date": start.isoformat(),
                "end_date": (start + timedelta(days=days)).isoformat(),
                "story": rng.choice(STORIES).format(city=name.split(",")[0], days=days, activity=rng.choice(ACTIVITIES)),
                "embed_photos": rng.choice(("true", "false")),
            }).raise_for_status()
    finally:
        for client in clients:
            client.close()
    print(f"Created {points} locations for {users} users at {url.rstrip('/')}.")


if __name__ == "__main__":
    app()
