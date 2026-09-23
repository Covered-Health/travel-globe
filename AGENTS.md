# Travel Globe contributor guide

Travel Globe is a React 19 single-page app backed by FastAPI and SQLite. The
production image serves the built frontend and API from FastAPI; local Vite
development proxies `/api` and `/uploads` to port 8000.

## Commands

```sh
uv run pytest
pnpm test -- --run
pnpm typecheck
pnpm build
pnpm test:e2e
```

Run the narrowest relevant check while working, then run the full affected
suite before handing off a change.

## Structure

- `backend/app.py`: API, authentication, SQLite schema, and uploaded files.
- `backend/tests/`: HTTP-level tests using temporary SQLite databases.
- `src/App.tsx`: routes and primary interface components.
- `src/journeys.ts`: globe route and journey ordering algorithms.
- `src/style.css`: responsive visual system built with MUI and plain CSS.
- `e2e/`: browser-level critical-path checks.
- `helm/travel-globe/`: single-replica deployment with persistent storage.

## Conventions

- Keep TypeScript strict and Python changes small and explicit.
- Test backend behavior through FastAPI's HTTP interface; do not mock the database.
- Reuse MUI and the existing CSS patterns. Do not introduce another UI system.
- Preserve responsive behavior and accessible interaction states.
- Treat SQLite and uploaded photos as persistent data that must be considered together.
