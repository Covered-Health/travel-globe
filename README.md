# Travel Globe

Private traveler spaces with place autocomplete, dated locations, Markdown
stories, inline photo compositions and galleries, current-location clocks,
history filtering, a globe, and a timeline. A new email creates a traveler;
returning travelers use the same email and password.

## Run

Requirements: Python 3.14, uv, Node, and pnpm. SQLite is bundled with Python.

Create a browser API key in [MapTiler Cloud](https://cloud.maptiler.com/),
copy `.env.example` to `.env.local`, and set `VITE_MAPTILER_KEY`. This enables
the labeled Satellite Hybrid globe; without it, the app uses unlabeled imagery.

```sh
uv sync
uv run uvicorn backend.app:app --reload
pnpm install
pnpm dev
```

Open <http://localhost:5173>. The web app proxies `/api` and `/uploads` to
FastAPI on port 8000. The database defaults to `data/travel-globe.sqlite3`;
override `SQLITE_PATH`, `UPLOADS_PATH`, or `WEB_ORIGIN` as needed. Back up
both the SQLite file and uploaded photos together.

## Kubernetes

Build and push a single image containing the API and built frontend, then
install the chart. The MapTiler key is public browser configuration baked into
the frontend at build time.

```sh
docker build --build-arg VITE_MAPTILER_KEY=your-browser-key -t registry.example.com/travel-globe:latest .
docker push registry.example.com/travel-globe:latest
helm install travel-globe ./helm/travel-globe --set image.repository=registry.example.com/travel-globe --set image.tag=latest
kubectl port-forward service/travel-globe 8000:80
```

Open <http://localhost:8000>. The chart runs one pod with a persistent volume
mounted at `/data` for both the SQLite database and photos. Keep replicas at
one; SQLite on a shared PVC is not a multi-writer database. Set
`persistence.storageClassName` if your cluster has no default storage class.

The chart retains its PVC on uninstall; remove it explicitly only when you
intend to delete the data.

## Checks

```sh
uv run pytest
pnpm test -- --run
pnpm test:e2e
pnpm build
pnpm preview
```
