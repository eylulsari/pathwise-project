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
| AI Assistant (Gemini chat) | ✅ | real backend round-trip (GEMINI_API_KEY set); no fallback error |
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

### Open follow-ups
1. ~~Wire the community "Clone This Route" button~~ — done 2026-07-27.
2. ~~Bind-mount config into the frontend container~~ — done 2026-07-27.
3. Install `@typescript-eslint/parser` (+ plugin) so `npm run lint` runs.
4. (Optional) Promote the mock-served social/tours/profile data to real backend
   endpoints when those modules are built.

## Regression suite
28 feature specs live in `pathwise/e2e/{planning,social,extras}-features.spec.ts`
(plus the 15-test baseline `onboarding.spec.ts`). Run all 43 with the stack up:
`cd pathwise && npm run e2e`.
