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
| Cache     | In-process, single-instance by design (see ARCHITECTURE)         |
| Auth      | JWT (short-lived access + refresh token)                         |
| Infra     | Docker + Docker Compose (multi-stage backend Dockerfile)         |

## Repository layout

```
pathwise/            # Frontend (Vite React app)
pathwise-backend/    # Backend (NestJS modular monolith)
docker-compose.yml   # Brings up frontend + backend + postgres
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

> Local backend needs PostgreSQL running. The easiest path is
> `docker compose up postgres` and then run the backend from your host.

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

## Place data

The backend owns the dataset — **124 places across 10 hubs** — in
`pathwise-backend/src/modules/places/infrastructure/persistence/`. Edit
`place.dataset.ts` / `hub.dataset.ts` there, then regenerate the frontend copy:

```bash
node scripts/sync-frontend-places.mjs           # regenerate pathwise/src/hubData.ts
node scripts/sync-frontend-places.mjs --check   # CI: fail if it is stale
```

`pathwise/src/hubData.ts` is **generated — never edit it by hand.** CI fails if
it disagrees with the backend, which is what stops the two halves drifting apart
(they once differed by 13 places, undetected, for months).

To seed coordinates for new places, add them to
`scripts/data/pathwise-places.json` and run:

```bash
node scripts/geocode-places.mjs        # Nominatim, 1 req/s, resumes from cache
```

It reports every place it could not resolve and every hit that looks wrong —
a coordinate is rejected if it falls outside Istanbul **or** sits too far from
its hub centre. That second check is the one that matters: "Moda Sahili" resolves
to a park in Bethlehem and "Yeni Cami" to a mosque in Beykoz, and only the
hub-distance test catches the second. Nothing unresolved is ever filled in by
hand-waving — those places are simply left out.

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

## Deploy (Render, free tier)

One web service serves **both halves**: the API under `/api`, the built SPA at
everything else. That is deliberate — the refresh token is an httpOnly
`SameSite=Lax` cookie, and Safari, Firefox and Brave block that cookie on
cross-site requests, so a split frontend/backend origin would silently log
users out every 15 minutes. No Redis (removed), no separate static site.

`render.yaml` is a Blueprint: Render reads it and creates the service plus a
free Postgres, so nothing below has to be clicked together by hand.

### Steps

1. **New → Blueprint** in the Render dashboard, point it at this repo.
   It picks up `render.yaml` and proposes `pathwise` (web) + `pathwise-db`.
2. Render prompts for the values marked `sync: false`. Set:

   | Variable | Required? | Notes |
   | -------- | --------- | ----- |
   | `JWT_ACCESS_SECRET` | **yes** | any long random string |
   | `JWT_REFRESH_SECRET` | **yes** | a *different* long random string |
   | `GROQ_API_KEY` | no | AI assistant; without it the assistant returns canned answers |
   | `OPENWEATHER_API_KEY` | no | weather widget; without it a static payload is used |
   | `GEMINI_API_KEY` | no | secondary LLM, only tried if Groq fails |
   | `CORS_ORIGINS` | no | leave blank — same origin, so CORS is never exercised |

   Everything else (database credentials, `DB_SYNCHRONIZE=false`, `DB_SSL`,
   `AUTH_THROTTLE_LIMIT`, token TTLs) is already in `render.yaml`. **Database
   credentials are wired by Render itself** — never paste them.
3. **Apply**. First build takes a few minutes (it builds the SPA and the API).
4. On boot the container runs `npm run migration:run:prod` before starting, so
   the schema is created by migrations. `DB_SYNCHRONIZE` stays `false` — TypeORM
   never improvises against production.
5. Check `https://<your-service>.onrender.com/api/health` → `{"status":"ok"}`.
   Then open the root URL; deep links like `/social` work directly.

### Things worth knowing

- **The free instance sleeps** after ~15 minutes idle. The first request then
  takes ~50 seconds while it wakes. `healthCheckPath: /api/health` is what
  Render pings.
- **Sessions survive restarts** — refresh tokens are rows in Postgres, so a
  sleep/wake cycle does not log anyone out.
- **`DB_SSL` defaults to `true`** here. If Render's private network refuses
  SSL, set it to `false` in the dashboard; it is the first thing to try if the
  service cannot reach the database.
- **Caches and quota counters are in-process**, which is correct for the single
  free instance. Scaling to more than one requires a shared store again — see
  ARCHITECTURE.md.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — patterns, module boundaries, data model
- [CONTRIBUTING.md](./CONTRIBUTING.md) — commit conventions & branch naming
