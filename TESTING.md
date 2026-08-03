# Pathwise — Feature Test Log

Living record of which features have been **genuinely exercised end-to-end**
against the running stack (`docker compose up -d`, frontend :5173 / backend
:3000), versus only coded. A next session can read this to know where to resume.

**Legend**
- ✅ **works** — driven end-to-end, behaves correctly
- ⚠️ **mock** — works, but the data is served from the frontend mock layer by
  design (no live backend endpoint yet) — behavior real, data not
- ❌ **broken** — errors / does not function
- ⛔ **not yet tested**

**How tested:** Playwright against the live docker stack. Baseline suite =
`e2e/onboarding.spec.ts` (15 tests). Batch 1 = a temporary `e2e/_audit1.spec.ts`
(10 tests, since removed). Backend unit tests: `pathwise-backend` (route
hub-budget, quiz-vibe, factory, auth, weather).

> **Environment finding (2026-07-27):** the running `pathwise-frontend`
> container only bind-mounts `./pathwise/src`, **not** `tailwind.config.js`
> (repo root of `pathwise/`). After the pastel-theme commit the container still
> had the OLD Tailwind config, so `index.css`'s `@apply bg-surface…` failed in
> PostCSS and the whole app white-screened (all 15 E2E failed). Fixed for this
> run by `docker cp pathwise/tailwind.config.js pathwise-frontend:/app/ &&
> docker compose restart frontend`. **Permanent fix (follow-up):** rebuild the
> frontend image, or add `./pathwise/tailwind.config.js` (+ `postcss.config.js`)
> to the compose bind-mounts so config edits reach the container.

---

## Verified ✅ / ⚠️  (2026-07-27)

### Core planning
| Feature | Status | Notes |
|---|---|---|
| Sign up → dashboard, auto first route | ✅ | real backend (auth + route engine) |
| Today's Path + Leaflet map + pins + OSRM route line | ✅ | real OSRM geometry (fallback to straight line) |
| Route generator controls present & regenerate | ✅ | baseline + pace-change path exercised |
| Vibe Quiz — full 3-step completion → rebuilds route | ✅ | real quiz-vibe strategy (backend) |
| Must-Visit picks **auto-apply on close + toast** | ✅ | new this session; toast "Route updated · N stops added" |
| Drag-and-drop reorder + Undo | ✅ | real rebuild endpoint |
| End point selector present | ✅ | heading + Auto option |
| Reservation pin + re-time + nearby suggestion visible | ✅ | real backend |
| Search a place → add (forced) to Today's Path | ✅ | real searchPlaces |

### Content / places
| Feature | Status | Notes |
|---|---|---|
| Live place enrichment (Wikipedia + OSM) | ✅ | real external APIs |
| Community reviews — post & list | ✅ | real reviews backend |
| Local Story modal (opens; reviews + enrichment inside) | ✅ | free/premium story gating + audio preview still ⛔ (not asserted) |
| Curated + live tours; Sync Live; "Set as Itinerary" | ⚠️ | tour data is mock (`getCuratedTours`/`syncLiveTours`); "set as itinerary" runs the real route engine |

### Money / export / offline
| Feature | Status | Notes |
|---|---|---|
| Currency converter (live Frankfurter) | ✅ | converted budget shown |
| Calendar `.ics` export | ✅ | downloads .ics |
| PDF export (print-ready popup) | ✅ | opens popup with itinerary; free monthly gate intact |
| Split Bill | ✅ | client-side calc |
| Save plan → Profile › Past Trips | ✅ | real saveTrip/getTrips; "Saved" badge appears |
| Offline mode (banner, disabled actions, IndexedDB cache) | ✅ | client + service worker |
| Selective per-day offline download | ✅ | size + "Saved" state |

### Social / safety / platform
| Feature | Status | Notes |
|---|---|---|
| Notification center (nearby alert, unread badge, mute) | ✅ | real backend notifications |
| Group polls — create / vote / tally | ✅ | real backend polls |
| SOS — confirm, emergency info, share location | ✅ | real backend sos alert |
| Premium/paywall (trial→free→premium, Day 2 lock, optimize limit) | ✅ | real subscription + usage |
| AI Assistant (chat) | ✅ | **live on Groq since 2026-08-03** — real round-trip, `source: "groq"` (see the Groq section) |
| Journal (photo/note/rating per stop) | ✅ | real backend upsert (modal closes on success) |
| Profile tabs — passport / visited / past trips | ⚠️ | tabs render; badges & sample past-trips are mock data (`getBadges`, `getPastTrips`); stats real |
| Language toggle EN/TR | ✅ | client i18n |

### Social cluster + referral (Batch 2 — 2026-07-27)
| Feature | Status | Notes |
|---|---|---|
| Check-in "I'm Here" composer (#28) | ⚠️ | posts to the feed, but client-only on mock data (not persisted) |
| Buddy connect + tag filter + TravelerModal + Turkey map (#29) | ⚠️ | works on mock travelers; "connect" persisted to localStorage only, not backend |
| Community route **like** (#30) | ⚠️ | client-only optimistic toggle on mock data (no backend persist) |
| Community route **Clone** (#30) | ✅ | **fixed 2026-07-27** (commit `fix(social): wire the community "Clone This Route" button`) — now hands the route's hub to the dashboard and rebuilds Today's Path |
| Forum quick answer (#31) | ⚠️ | answer appears, client-only on mock (not persisted; no "ask new question" UI) |
| Report content / moderation (#32) | ✅ | **real backend** `reportContent` → "✓ Reported" |
| Poll winner → Today's Path (#27) | ✅ | real poll backend + cross-page localStorage handoff injects the winner |
| Referral redeem (user A code → user B) (#42) | ✅ | **real backend**; "🎉 Reward applied!" |

---

## Findings
- ~~Community "Clone This Route" button is not wired~~ — **RESOLVED 2026-07-27**: wired to clone the route's hub into Today's Path.
- ~~Frontend container drifts from repo config~~ — **RESOLVED 2026-07-27**: `docker-compose.yml` now bind-mounts `tailwind.config.js` + `postcss.config.js`.

---

### Low / small / partial (Batch 3 — 2026-07-27)
| Feature | Status | Notes |
|---|---|---|
| Survival widget accordion (#36) | ✅ | expands categories |
| Weather widget live display (#37) | ✅ | shows a temperature (OPENWEATHER_API_KEY set → live; mock fallback also shows a temp) |
| Mid-stop time anchor one-click pin (#7) | ✅ | "⏰ Lock time" → "⚓ Locked", re-times the day |
| Nearby-suggestion **Add** (#8) | ✅ | suggested place is injected into Today's Path |
| Start/End custom-origin routing (#9) | ✅ | Hotel origin sets "Starting from…"; route regenerates from it |
| Over-budget → notification (#16) | ✅ | min budget + max pace → 💸 budget notification in the bell |
| Review "helpful" upvote (#14) | ✅ | **real backend** `markReviewHelpful` increments the count |
| Map fullscreen toggle (#11) | ✅ | ⛶ Full screen ↔ ✕ Close |
| Cross-day stop move via drag (#5) | ✅ | works; drag-and-drop is timing-sensitive (passes on retry) |
| Local Story free/premium gating (#12) | ✅ | free user sees locked "Full audio guide" + Unlock CTA; premium/trial sees full |
| Refresh-token rotation (#40) | ✅ | stale access token in localStorage is silently rotated via the refresh cookie on reload |

---

## Summary (2026-07-27)
- **43 features exercised end-to-end** against the live docker stack (15 baseline
  E2E + 28 audit tests). All pass.
- **Real backend & external APIs verified working:** auth (+ refresh rotation),
  route engine (hub-budget + quiz-vibe), rebuild/reorder, reservations, save/get
  trips, journal, reviews (+ helpful), notifications (incl. budget), polls,
  referral redeem, report/moderation, SOS, subscription/paywall, currency
  (Frankfurter), weather (OpenWeather), place enrichment (Wikipedia/OSM), AI
  assistant (Gemini), search, route geometry (OSRM).
- **Mock-by-design (⚠️ — UI works, data is frontend mock, no backend endpoint
  yet):** curated/live tours, travelers/buddies, check-ins, community routes
  (like), forum, badges & sample past-trips. These are intentional per
  `api.ts` (documented swap points).
- **Broken (❌):** 1 item — community **"Clone This Route"** button is not wired.
- **Environment gotcha:** the frontend container did not have the new
  `tailwind.config.js` (not bind-mounted); it was `docker cp`'d in for this run.
  Rebuild the image or add the mount so it doesn't regress.

### Route completion celebration (commit `14cd2bd`) — ⚠️ untested
Confetti + summary card when every stop on Today's Path is ticked off.
Type-checks and is wired end-to-end in the code (`DayCelebration.tsx`,
Dashboard state + once-per-plan guard, TodayPath visited toggle), but it has
**never been driven in a browser** and has no e2e spec.

### Open follow-ups
1. ~~Wire the community "Clone This Route" button~~ — done 2026-07-27.
2. ~~Bind-mount config into the frontend container~~ — done 2026-07-27.
3. ~~Install `@typescript-eslint/parser` (+ plugin) so `npm run lint` runs~~ — done 2026-07-28: parser + typescript-eslint / react-hooks / react-refresh plugins wired; `npm run lint` passes (0 errors, 2 non-blocking warnings).
4. (Optional) Promote the mock-served social/tours/profile data to real backend
   endpoints when those modules are built.

### Opt-in women-traveler safety mode (2026-08-02)

Optional, self-declared mode added across profile → buddy finder → SOS. Three
independent preferences on the user (`identifiesAsWoman`, `visibleToWomenOnly`,
`showWomenOnly`), all unset/off by default; nobody is ever asked for a gender.

> **This is a self-declaration system — no identity verification is performed.**
> The disclaimer ("Bu mod tamamen gönüllü kendini-beyan sistemine dayanır,
> kimlik doğrulaması yapılmaz") renders next to the filter and in the profile
> panel. A future real verification mechanism must use a separate field — see
> the `TODO(verification)` notes in `user.ts`, `traveler.ts` and the migration.

| Feature | Status | Notes |
|---|---|---|
| `PATCH /users/me/safety-preferences` (partial update) | ✅ | real backend, driven against the live stack |
| `GET /social/travelers?womenOnly=` filter | ✅ | **8 unit tests** + live API run |
| Profile › Privacy & safety panel (3 checkboxes + disclaimer) | ⛔ | coded, type-checked + linted; not yet driven in a browser |
| Buddy Finder 🚺 chip + disclaimer + reciprocal badge | ⛔ | coded, type-checked + linted; not yet driven in a browser |
| SOS "share only with connected women buddies" sub-option | ⛔ | coded, type-checked + linted; not yet driven in a browser |

**API verification against the running stack (2026-08-02)** — a fresh account
walked through the whole flow, 7/7 as designed:

| # | Step | Result |
|---|---|---|
| 1 | register | `identifiesAsWoman: null`, both switches `false` — nothing preselected |
| 2 | list buddies, not opted in | `t1,t2,t4,t5` — `t3` (women-only visibility) hidden; no `identifiesAsWoman` on any payload |
| 3 | `?womenOnly=true`, not opted in | **refused** — full list returned, `womenOnlyApplied: false` |
| 4 | opt in (declaration + showWomenOnly) | persisted |
| 5 | `?womenOnly=true`, opted in | `t1,t3,t4` — only declared travelers; `visibleToWomenOnly` never serialised |
| 6 | patch one switch only | the other two preferences untouched |
| 7 | withdraw declaration | declaration back to `null`, both switches cleared |

**Reciprocity rule (enforced server-side, covered by the unit tests):** a viewer
who has not opted in themselves cannot (a) see travelers who chose women-only
visibility, (b) read `identifiesAsWoman` off any payload, or (c) apply the
`womenOnly` filter — (c) is refused explicitly because list membership would
otherwise leak exactly what (b) redacts. `visibleToWomenOnly` is never exposed
to anyone.

**Backend suite is now 39 tests** (was 31), 6 suites, no DB needed.

## Regression suite
28 feature specs live in `pathwise/e2e/{planning,social,extras}-features.spec.ts`
(plus the 15-test baseline `onboarding.spec.ts`). Run all 43 with the stack up:
`cd pathwise && npm run e2e`.

**Last full run — 2026-08-02, after the women-traveler mode:** 42 passed, 1
flaky (`social-features.spec.ts:70` poll-winner → Today's Path timed out once,
passed on retry — the same drag/timing sensitivity already noted for #5, not
related to this feature). Backend `npm test`: 39/39. Frontend `npm run lint`:
0 errors (2 pre-existing warnings). `tsc --noEmit`: clean both sides.

> Known pre-existing lint error, unrelated and untouched:
> `hub-budget.strategy.ts:3` imports `Interest` without using it, so
> `pathwise-backend`'s `npm run lint` exits non-zero.

### Not yet covered
- No e2e spec drives the women-traveler UI (profile panel → 🚺 chip → SOS
  sub-option). The filter's *logic* is covered by unit tests + the live API
  run above; the *UI wiring* is not.
- No e2e spec covers the route-completion celebration either (see below).

## Pre-demo hardening pass (2026-08-03)

No new features — stabilisation only, ahead of a live demo. Full stack rebuilt
from zero (`docker compose down -v` → `up --build`): all four services healthy,
**no errors or warnings** in the boot logs, backend ready in ~30 s.

### AI assistant safety net — ✅ verified degraded-mode
With **no working LLM key** (no `GROQ_API_KEY`; the `AQ.`-prefixed
`GEMINI_API_KEY` 401s), three real questions were driven through
`POST /api/assistant/chat` on the live stack:

| Question | HTTP | `source` | Answer |
|---|---|---|---|
| "What if it rains?" | 200 | `fallback` | Hagia Sophia (indoor) |
| "Best sunset spot?" | 200 | `fallback` | Gülhane Park |
| "Cheap eats nearby" | 200 | `fallback` | Moda Dondurma |

Every reply carried a **real** `placeId` from the dataset. Backend logged
`WARN … using fallback`; **0 ERROR lines**. The UI shows a normal answer — no
error state is reachable from a provider failure.

> `ChatRateLimitGuard` now **fails open** when Redis is unreachable. It
> previously threw, which would have turned a Redis hiccup into a hard 500 on
> every chat message.

### Crash containment — ✅ new `ErrorBoundary`
There was **no error boundary anywhere**: any render-time throw white-screened
the whole app. Added `components/ErrorBoundary.tsx` and wrapped
(a) each route, so a crash is scoped to one page and the others stay navigable,
(b) `DayCelebration` with `fallback={null}` — the confetti silently skips,
(c) `SafetyPreferences` with a quiet "temporarily unavailable" notice.

**Verified by deliberately throwing** inside `SafetyPreferences`: `/profile`
still rendered with the fallback notice, and `/dashboard` stayed fully usable.
The deliberate throw was then reverted.

### Fixed: unhandled rejection on the dashboard
`POST /itinerary/suggest-nearby` answers `200` with an **empty body** when there
is nothing to suggest; `http()` called `res.json()` on it and threw
`Unexpected end of JSON input` as an unhandled rejection (red console error on
every dashboard load). `http()` now tolerates an empty body, and the caller has
a `.catch`. The dashboard console is clean.

### Screen sweep — ✅ all clean
Landing · SignUp · Dashboard · Dashboard+assistant · Social · Profile, checked
for console errors, uncaught errors, failed requests, 5xx, broken images,
unlabelled buttons and text leaking `undefined` / `NaN` / `[object Object]` /
raw i18n keys. **All six clean** after the fix above.

Separately, an i18n audit across 60 files found **294 distinct `t()` keys, all
present in both `en` and `tr`** — no screen can render a raw key.

### Groq provider — ✅ live and verified (2026-08-03)

`GROQ_API_KEY` set in the root `.env`; `GROQ_MODEL` unset, so the code default
`openai/gpt-oss-20b` applies. Three real questions on the live stack:

| Question | `source` | Answer | Card |
|---|---|---|---|
| "Kadıköy'de ucuz bir kahvaltı nerede yapabilirim?" | `groq` | "…Kadıköy Market offers a lively breakfast spread with affordable options…" | Kadıköy Market (Çarşı) |
| "I have 2 hours before sunset and I am in Galata…" | `groq` | "…panoramic sunset view over the Bosphorus…" | Galata Tower |
| "Yağmur yağıyor, Sultanahmet'te kapalı bir yer öner" | `groq` | "…A magnificent indoor museum to explore while staying dry." | Hagia Sophia |

Each answer is dynamic and context-specific (not the canned set), each card
carries a real `placeId`, and the backend logged **0 ERROR lines** with no
fallback warnings. Gemini is no longer configured (`GEMINI_API_KEY` empty), so
the chain is now Groq → canned fallback.

> **Gotcha that cost a debugging round:** container environment variables are
> fixed at **creation** time. Editing `.env` while the stack is up changes
> nothing, and `docker compose restart` does not help either — it restarts the
> process, not the container. The key was present in `.env` and correctly
> resolved by `docker compose config`, yet `printenv` inside the running backend
> showed `GROQ_API_KEY` with **length 0**, because that container had been
> created 3 minutes before the file was saved. Fix: `docker compose down` +
> `up` (or `up -d`, which recreates on config change).

> **Known behaviour:** the system instruction is English and does not tell the
> model to reply in the user's language, so a Turkish question currently gets an
> English answer (see the third row above). Not a fault — just decide before
> demoing in Turkish.

### Status of the two half-finished features
Neither was rewritten (deliberately — too close to the demo); both are now
contained so they cannot take a page down.

| Feature | Status |
|---|---|
| Route-completion celebration | ⚠️ still not driven in a browser; now crash-contained (`fallback={null}`) |
| Women-traveler mode UI (profile panel, 🚺 chip, SOS sub-option) | ⚠️ still no e2e spec; profile panel crash-contained. Backend logic remains ✅ (8 unit tests + live API run) |

### Regression after the pass
`npm run e2e`: **43/43 passed, 0 flaky.** Backend `npm test`: **39/39**.
`tsc --noEmit`: clean both sides. Frontend `npm run lint`: 0 errors (2
pre-existing warnings). Backend `npm run lint`: the 1 known pre-existing
`hub-budget.strategy.ts` error, untouched.

> **Demo risk to know about:** the story-modal "Live details" panel depends on
> live Wikipedia/OSM calls and was the flaky test in the earlier run of the day.
> If those APIs are slow during the demo the panel may lag; everything else is
> served locally.

---

## Information architecture — current flows (2026-07-27)
- **Sign-up → first route:** Landing CTA → auth form → `Create account` lands
  **directly on `/dashboard`** (no `/success` interstitial), where Day 1's route
  **auto-generates**. ~2 clicks to a live plan. Sign-in follows the same path.
- **Dashboard ordering is state-aware** (`showResultsFirst = day.itinerary || day.loading`):
  - With a route (the usual case) → **results-first**: Today's Path leads, Map
    next, the build/discovery controls become a secondary rail — on mobile *and*
    desktop (`xl:grid-cols-[minmax(340px,420px)_1fr_320px]`).
  - No route (error / offline-without-cache) → **discovery-first**: the controls
    (RouteGenerator, Vibe Quiz, Must-Visit) lead so the user can build one.
- **Must-Visit picks auto-apply** on picker close (no extra "Generate" tap) with
  a "Route updated · N stops added" toast.
- **Social / Profile** are one click from the persistent top nav on every screen
  (there is no bottom nav). No shortcut needed.
- These flows are exercised by the regression suite (e.g. the reorder does not
  change any role/text selectors, so all 43 specs still pass).
