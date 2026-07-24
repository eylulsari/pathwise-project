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

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — patterns, module boundaries, data model
- [CONTRIBUTING.md](./CONTRIBUTING.md) — commit conventions & branch naming
