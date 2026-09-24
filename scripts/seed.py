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
FIRST_NAMES = """Amina Arjun Ava Camila Daniel Diego Elena Elias Emma Farah Felix Hana Hugo Ines
Jack Jia Kai Layla Leo Lucia Maya Mateo Mina Nadia Noah Noura Omar Priya Ravi Sofia Theo Yara Zane""".split()
LAST_NAMES = """Alvarez Andersson Bennett Chen Costa Dubois Fischer Garcia Haddad Ibrahim Ivanov
Jensen Kim Kowalski Kumar Laurent Martin Mensah Mori Mueller Nakamura Novak Okafor Patel Petrov Rossi
Santos Silva Singh Smith Tanaka Thompson Torres Wang Williams Yilmaz""".split()
DOMAINS = ["example.com", "example.net", "example.org"]
CITIES = [
    ("Lisbon, Portugal", 38.72, -9.14, "Europe/Lisbon"),
    ("Porto, Portugal", 41.15, -8.61, "Europe/Lisbon"),
    ("Paris, France", 48.86, 2.35, "Europe/Paris"),
    ("Rome, Italy", 41.90, 12.50, "Europe/Rome"),
    ("Berlin, Germany", 52.52, 13.41, "Europe/Berlin"),
    ("Prague, Czechia", 50.08, 14.44, "Europe/Prague"),
    ("Vienna, Austria", 48.21, 16.37, "Europe/Vienna"),
    ("Athens, Greece", 37.98, 23.73, "Europe/Athens"),
    ("Istanbul, Türkiye", 41.01, 28.98, "Europe/Istanbul"),
    ("London, United Kingdom", 51.51, -0.13, "Europe/London"),
    ("Edinburgh, United Kingdom", 55.95, -3.19, "Europe/London"),
    ("Oslo, Norway", 59.91, 10.75, "Europe/Oslo"),
    ("Stockholm, Sweden", 59.33, 18.07, "Europe/Stockholm"),
    ("Copenhagen, Denmark", 55.68, 12.57, "Europe/Copenhagen"),
    ("Helsinki, Finland", 60.17, 24.94, "Europe/Helsinki"),
    ("Tallinn, Estonia", 59.44, 24.75, "Europe/Tallinn"),
    ("Kyoto, Japan", 35.01, 135.77, "Asia/Tokyo"),
    ("Tokyo, Japan", 35.68, 139.69, "Asia/Tokyo"),
    ("Seoul, South Korea", 37.57, 126.98, "Asia/Seoul"),
    ("Taipei, Taiwan", 25.03, 121.57, "Asia/Taipei"),
    ("Bangkok, Thailand", 13.76, 100.50, "Asia/Bangkok"),
    ("Singapore", 1.35, 103.82, "Asia/Singapore"),
    ("Hanoi, Vietnam", 21.03, 105.85, "Asia/Bangkok"),
    ("Mumbai, India", 19.08, 72.88, "Asia/Kolkata"),
    ("Delhi, India", 28.61, 77.21, "Asia/Kolkata"),
    ("Kathmandu, Nepal", 27.72, 85.32, "Asia/Kathmandu"),
    ("Dubai, United Arab Emirates", 25.20, 55.27, "Asia/Dubai"),
    ("Tbilisi, Georgia", 41.69, 44.80, "Asia/Tbilisi"),
    ("Reykjavík, Iceland", 64.15, -21.94, "Atlantic/Reykjavik"),
    ("Cape Town, South Africa", -33.92, 18.42, "Africa/Johannesburg"),
    ("Nairobi, Kenya", -1.29, 36.82, "Africa/Nairobi"),
    ("Lagos, Nigeria", 6.52, 3.38, "Africa/Lagos"),
    ("Accra, Ghana", 5.56, -0.19, "Africa/Accra"),
    ("Cairo, Egypt", 30.04, 31.24, "Africa/Cairo"),
    ("Buenos Aires, Argentina", -34.60, -58.38, "America/Argentina/Buenos_Aires"),
    ("Santiago, Chile", -33.45, -70.67, "America/Santiago"),
    ("Rio de Janeiro, Brazil", -22.91, -43.17, "America/Sao_Paulo"),
    ("São Paulo, Brazil", -23.55, -46.63, "America/Sao_Paulo"),
    ("Lima, Peru", -12.05, -77.04, "America/Lima"),
    ("Cusco, Peru", -13.53, -71.97, "America/Lima"),
    ("Bogotá, Colombia", 4.71, -74.07, "America/Bogota"),
    ("Mexico City, Mexico", 19.43, -99.13, "America/Mexico_City"),
    ("Havana, Cuba", 23.11, -82.37, "America/Havana"),
    ("New York, United States", 40.71, -74.01, "America/New_York"),
    ("San Francisco, United States", 37.77, -122.42, "America/Los_Angeles"),
    ("Seattle, United States", 47.61, -122.33, "America/Los_Angeles"),
    ("Vancouver, Canada", 49.28, -123.12, "America/Vancouver"),
    ("Montréal, Canada", 45.50, -73.57, "America/Toronto"),
    ("Marrakesh, Morocco", 31.63, -8.00, "Africa/Casablanca"),
    ("Melbourne, Australia", -37.81, 144.96, "Australia/Melbourne"),
    ("Sydney, Australia", -33.87, 151.21, "Australia/Sydney"),
    ("Auckland, New Zealand", -36.85, 174.76, "Pacific/Auckland"),
    ("Queenstown, New Zealand", -45.03, 168.66, "Pacific/Auckland"),
    ("Honolulu, United States", 21.31, -157.86, "Pacific/Honolulu"),
]
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
            name, latitude, longitude, timezone = rng.choice(CITIES)
            start = date.today() - timedelta(days=rng.randrange(10, 3_000))
            days = rng.randrange(2, 31)
            owner = number if number < users else rng.randrange(users)
            clients[owner].post("/api/locations", data={
                "name": name,
                "latitude": latitude + rng.uniform(-0.08, 0.08),
                "longitude": longitude + rng.uniform(-0.08, 0.08),
                "timezone": timezone,
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
