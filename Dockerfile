FROM node:26-bookworm-slim AS frontend
WORKDIR /app
RUN npm install -g pnpm@10.33.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html vite.config.ts ./
COPY src ./src
COPY public ./public
ARG VITE_MAPTILER_KEY
RUN VITE_MAPTILER_KEY="$VITE_MAPTILER_KEY" pnpm build

FROM python:3.14-slim AS python-deps
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

FROM python:3.14-slim
WORKDIR /app
COPY --from=python-deps /app/.venv ./.venv
COPY --from=frontend /app/dist ./dist
COPY backend ./backend
ENV PATH="/app/.venv/bin:$PATH" SQLITE_PATH=/data/travel-globe.sqlite3 UPLOADS_PATH=/data/uploads DIST_PATH=/app/dist
EXPOSE 8000
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
