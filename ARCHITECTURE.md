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
│  auth │ users │ itinerary │ places │ social │ points │ …   │
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

### Pure domain scoring — buddy matching
`social/domain/matching.ts` holds the compatibility score as **pure functions**
with no framework imports, so the whole economy is testable without a DB, a
container or a clock. `MatchingService` (application) does nothing but assemble
the caller's profile out of three modules — styles from `users`, preferred hubs
and budget level derived from `trips` — and hand it to those functions.

The score is a weighted sum of three components normalised to 0–100:

| Component | Weight | Source |
| --------- | ------ | ------ |
| Shared style tags | 50 | `users.travelStyles` (quiz-derived + hand-edited) |
| Overlapping preferred hubs | 30 | derived from the user's saved trips |
| Budget proximity | 20 | derived from average trip spend |

The weights are the entire tuning surface. Two rules matter more than the
numbers: **filtering and ranking are separate** (ranking only reorders what the
tag/women-traveler filters already allowed, so it can never surface someone a
filter excluded), and **missing data is skipped rather than scored as zero** —
the remaining weights are renormalised, and a user with nothing to compare gets
`null` rather than a fabricated percentage.

### Ledger over counter — reward points
`users.points` is a denormalised balance for cheap reads, but every change is
also written to the append-only `point_transactions` table, so the balance
stays reconstructable and explainable. Only `PointsService` writes either.
Points accrue on four actions and are granted by the module that owns each
action (analytics/affiliate, referral, reviews, and a points endpoint for route
completion). There is no reward catalogue yet — accrual and visibility only.

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
  ├──1:N── point_transactions (append-only ledger)      │
  ├──1:N── check_ins ─────────────────────────────────┘ (place_id)
  ├──1:N── badges (earned + in-progress)
  └──M:N── buddy_connections (users ↔ users)

community_routes ──1:N── route_likes
forum_questions  ──1:N── forum_answers
```

> **Built vs. planned.** `users`, `trips`, `point_transactions`,
> `place_reviews`, `trip_journal_entries`, `referral_codes`/`redemptions`,
> `content_reports`, `affiliate_clicks`, polls and notifications are real
> tables. `check_ins`, `badges`, `buddy_connections`, `community_routes` and
> the forum are still served from the frontend mock layer — the diagram shows
> the intended shape, and `api.ts` marks each swap point.

SQL/PostgreSQL was chosen because users, trips, itineraries, check-ins and
badges have clear relational structure and referential integrity needs.

## 6. Mock data layer (frontend)

`src/mockData.ts` and `src/hubData.ts` shape every record like its real source
and document the origin in comments:

| Source                        | Fields it feeds                                   |
| ----------------------------- | ------------------------------------------------- |
| Google Places API             | `place_id`, `lat/lng`, `rating`, `photo_url`, …   |
| OpenStreetMap/Overpass + OSRM | walking geometry (LIVE OSRM foot routing on the map, straight-line fallback), distance/duration |
| IBB Open Data                 | transit info, museum-pass validity                |
| GetYourGuide / TripAdvisor    | curated & live tours, source badges               |
| OpenWeatherMap                | weather widget                                     |

`src/services/api.ts` holds every data call as an `async` function with a
simulated delay and a commented real-`fetch()` example beside it, so swapping to
live endpoints is a local change.
