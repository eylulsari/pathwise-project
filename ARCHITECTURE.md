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
│   PostgreSQL (TypeORM)      in-process cache (1 instance) │
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

`HubBudgetStrategy` bounds a day by **two** limits: the pace budget in minutes,
and a **stop cap** (3/5/7/8 by pace). The cap exists because the first was not
enough once the dataset grew — with 5–6 candidates per hub everything fit and
the cap would have been invisible, but with 12–15 the time budget alone packs a
seven-hour day with ten or more stops. Must-visits and reservations are exempt:
the user asked for those explicitly, so dropping one would be a bug, not pacing.

### Factory Pattern
`RouteStrategyFactory` returns the correct strategy for a given `mode` string
(`"hub-budget"` | `"quiz-vibe"`).

### One dataset, one owner — places and hubs
`PLACE_DATASET` and `HUB_DATASET` in the backend are the **single source of
truth for both halves of the app**. 124 places across 10 hubs, served by
`GET /api/places` and `GET /api/places/hubs`.

This used to be two hand-maintained copies, and they drifted: the route engine
planned over 28 places while the frontend map and bucket list drew from 41, with
13 that existed on one side only. Nothing noticed, because nothing compared them.

`pathwise/src/hubData.ts` is now a **generated artifact**, produced by
`node scripts/sync-frontend-places.mjs` and verified in CI with `--check` — a
stale artifact fails the build. A runtime fetch was the other option and was
rejected: four components look places up synchronously by id, so switching would
have meant rewriting component flow and loading states (and the e2e suite along
with them) purely to move where data comes from. A generated file closes the
divergence with no behaviour change at all.

The artifact is a **projection** — `placeId`, `name`, `hub`, `lat/lng`,
`entryFeeTry` — because that is all the synchronous lookups read. Full `Place`
records, with their tips and transit notes, reach the UI on itinerary stops
straight from the API, so shipping them twice would only cost bundle weight.

Coordinates are seeded offline by `scripts/geocode-places.mjs` (Nominatim), never
at runtime: the Overpass enrichment client matches a POI by *proximity* to a
known lat/lng, so a coordinate is an input to enrichment, not an output of it.

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

### In-process cache — a single-instance choice, on purpose
Caches (currency rates, weather, place enrichment) and quota counters
(assistant chat, optimize limit, paywall tallies) live in
`MemoryStoreService`, not Redis. Dropping Redis removed a managed service the
free hosting tier charges for, and the app's only genuinely stateful use of it
(refresh tokens) moved to Postgres — where it is *more* durable.

**This is correct for one instance and wrong for several.** Each process would
keep its own cache (merely less efficient) and its own counters (a limit of N
per hour would become N *per instance* — actually wrong). Scaling out means
putting the quota counters back on a shared store; the service is a narrow
six-method facade precisely so that stays a one-file change.

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
2. Refresh token JTI stored in **Postgres** (`refresh_tokens`), which allows
   rotation + revocation **and survives a restart**.
3. `refresh` reads the cookie, verifies the JTI, rotates the token and
   re-sets the cookie. The frontend `api.ts` auto-runs this on any `401` and
   retries the original request once.
4. `logout` deletes the refresh JTI row and clears the cookie.

> Postgres has no TTL, so `expiresAt` is stored explicitly and checked on
> every validation — a row outliving its token must never authenticate. The
> repository prunes a user's expired rows when it writes a new one, which
> keeps the table bounded without a scheduler.

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

`src/mockData.ts` shapes every record like its real source and documents the
origin in comments. (`src/hubData.ts` is no longer part of this layer — it is
generated from the backend dataset; see *One dataset, one owner* above.)

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
