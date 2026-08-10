# Pathwise 🗺️

**Smart, social travel planning for Istanbul.** Pathwise builds budget-aware,
vibe-driven day itineraries across Istanbul's neighborhoods, drops them on an
interactive map, and connects solo travelers with verified buddies.

> This is a portfolio/education project. External data (Google Places, OSRM,
> IBB Open Data, GetYourGuide, OpenWeatherMap) is **mocked but shaped exactly
> like the real APIs** so the data layer can be swapped for live calls with
> minimal change. See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Stack

| Layer     | Tech                                                              |
| --------- | ---------------------------------------------------------------- |
| Frontend  | React + TypeScript + Vite + Tailwind CSS + react-leaflet         |
| Backend   | NestJS + TypeScript (modular monolith, hexagonal architecture)   |
| Database  | PostgreSQL (TypeORM)                                              |
| Cache/JWT | Redis (refresh-token store + cache)                              |
| Auth      | JWT (short-lived access + refresh token)                         |
| Infra     | Docker + Docker Compose (multi-stage backend Dockerfile)         |

## Repository layout

```
pathwise/            # Frontend (Vite React app)
pathwise-backend/    # Backend (NestJS modular monolith)
docker-compose.yml   # Brings up frontend + backend + postgres + redis
.env.example         # Copy to .env
```

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

- Frontend → http://localhost:5173
- Backend  → http://localhost:3000/api
- Health   → http://localhost:3000/api/health

## Local development (without Docker)

```bash
# Backend
cd pathwise-backend
npm install
npm run start:dev

# Frontend (new terminal)
cd pathwise
npm install
npm run dev
```

> Local backend needs PostgreSQL + Redis running. The easiest path is
> `docker compose up postgres redis` and then run the backend from your host.

## Testing

```bash
# Backend — unit tests (route engine, matching, points, auth). No DB needed.
cd pathwise-backend && npm test
cd pathwise-backend && npm run lint && npx tsc --noEmit

# Frontend — types + lint
cd pathwise && npm run typecheck && npm run lint

# Frontend E2E (real browser) — needs the stack running first
docker compose up -d
cd pathwise && npm run e2e        # or: npm run e2e:ui
```

The E2E suite (`pathwise/e2e/`) drives a real Chromium through onboarding →
dashboard and asserts the Leaflet map + Today's Path render with live data.
See [TESTING.md](./TESTING.md) for what has actually been exercised end-to-end.

> Use `npm run typecheck` (`tsc -b`), **not** `tsc --noEmit`, on the frontend.
> The root `tsconfig.json` is solution-style (`"files": []` + project
> references), so `tsc --noEmit` silently checks nothing.

> If the stack is up and healthy but every request from the host fails, it is
> almost certainly the IPv6 `localhost` path, not the app — `localhost`
> resolves to `::1` first on Windows and the WSL port relay can go stale after
> a sleep/resume. Check with `curl http://127.0.0.1:3000/api/health`; if that
> works, either restart Docker Desktop, or run locally against IPv4 by setting
> **in your own untracked `.env`** `VITE_API_URL=http://127.0.0.1:3000/api` and
> running the suite with `E2E_BASE_URL=http://127.0.0.1:5173`. The committed
> config stays on `localhost` so CI and other machines are unaffected; the
> backend allows both origins.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — patterns, module boundaries, data model
- [CONTRIBUTING.md](./CONTRIBUTING.md) — commit conventions & branch naming
