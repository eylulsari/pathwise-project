# Pathwise — Architecture

## 1. Big picture

Pathwise is a **modular monolith**. Each product capability lives in its own
NestJS module with clean boundaries so it could later be split into a
microservice without a rewrite.

```
┌──────────────────────────────────────────────────────────┐
│                     Frontend (Vite/React)                 │
│  services/api.ts  ──HTTP──►  Backend REST API (/api)      │
└──────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────────────────────────────────┐
│                  Backend (NestJS monolith)                │
│  auth │ users │ itinerary │ places │ social │ profile     │
│                                                            │
│   PostgreSQL (TypeORM)          Redis (refresh + cache)   │
└──────────────────────────────────────────────────────────┘
```

## 2. Per-module layering — Hexagonal / Clean Architecture

Every module is split into three layers:

```
<module>/
├── domain/          # Framework-free business rules: entities, value objects,
│                    # and *RepositoryPort / *Strategy interfaces (ports).
├── application/     # Use-cases (services) + DTOs. Orchestrates the domain.
└── infrastructure/  # Framework-bound adapters: controllers, TypeORM entities
                     # + repositories, guards. Implements the ports.
```

Dependencies point **inward**: `infrastructure → application → domain`. The
domain never imports NestJS or TypeORM.

## 3. Patterns

### Repository Pattern
Each domain entity defines a `*RepositoryPort` interface in `domain/`. A TypeORM
adapter in `infrastructure/` implements it (e.g. `UserRepositoryPort` ←
`TypeOrmUserRepository`). Services depend on the port, wired via a Nest DI token.

### Strategy Pattern — route generation engine
`RouteGenerationStrategy` is the port. Concrete strategies:

- **`HubBudgetStrategy`** — filters/scores stops by hub + budget + pace + group.
- **`QuizVibeStrategy`** — converts a quiz result into a hub + interests, then
  **delegates to `HubBudgetStrategy`** (DRY — no duplicated scoring logic).

### Factory Pattern
`RouteStrategyFactory` returns the correct strategy for a given `mode` string
(`"hub-budget"` | `"quiz-vibe"`).

### Validation & cross-cutting
- `class-validator` DTOs + global `ValidationPipe({ whitelist: true })`.
- Global exception filter → consistent error envelope.
- `JwtAuthGuard` + `@CurrentUser()` decorator.

## 4. Auth flow

1. `register` / `login` → **access token (~15m)** in the JSON body; **refresh
   token** delivered as an `httpOnly`, `sameSite=lax` cookie scoped to
   `/api/auth` (safe from XSS — JS never sees it).
2. Refresh token JTI stored in **Redis** (allows rotation + revocation).
3. `refresh` reads the cookie, verifies against Redis, rotates the token and
   re-sets the cookie. The frontend `api.ts` auto-runs this on any `401` and
   retries the original request once.
4. `logout` revokes the refresh JTI in Redis and clears the cookie.

**Hardening:** `helmet` security headers, and `@nestjs/throttler` rate limiting
(100 req/min globally, 10 req/min on the auth endpoints) via a global
`ThrottlerGuard`.

## 5. Data model (relational)

```
users ──1:N── trips ──1:N── itineraries ──1:N── itinerary_stops
  │                                                    │
  ├──1:N── check_ins ─────────────────────────────────┘ (place_id)
  ├──1:N── badges (earned + in-progress)
  └──M:N── buddy_connections (users ↔ users)

community_routes ──1:N── route_likes
forum_questions  ──1:N── forum_answers
```

SQL/PostgreSQL was chosen because users, trips, itineraries, check-ins and
badges have clear relational structure and referential integrity needs.

## 6. Mock data layer (frontend)

`src/mockData.ts` and `src/hubData.ts` shape every record like its real source
and document the origin in comments:

| Source                        | Fields it feeds                                   |
| ----------------------------- | ------------------------------------------------- |
| Google Places API             | `place_id`, `lat/lng`, `rating`, `photo_url`, …   |
| OpenStreetMap/Overpass + OSRM | walking geometry, distance/duration               |
| IBB Open Data                 | transit info, museum-pass validity                |
| GetYourGuide / TripAdvisor    | curated & live tours, source badges               |
| OpenWeatherMap                | weather widget                                     |

`src/services/api.ts` holds every data call as an `async` function with a
simulated delay and a commented real-`fetch()` example beside it, so swapping to
live endpoints is a local change.
