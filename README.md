# Travel Globe

Private traveler spaces with place autocomplete, dated locations, Markdown
stories, inline photo compositions and galleries, current-location clocks,
history filtering, a globe, and a timeline. A new email creates a traveler;
returning travelers use the same email and password.

## Run

Requirements: Python 3.14, uv, Node, pnpm, and MongoDB.

```sh
docker compose up -d mongo
uv sync
uv run uvicorn backend.app:app --reload
pnpm install
pnpm dev
```

Open <http://localhost:5173>. The web app proxies `/api` and `/uploads` to
FastAPI on port 8000. Override `MONGODB_URL`, `MONGODB_DATABASE`, or
`WEB_ORIGIN` as needed.

```sh
uv run pytest
pnpm test -- --run
pnpm test:e2e
pnpm build
pnpm preview
```
