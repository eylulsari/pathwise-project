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

> **Known behaviour — the assistant answers in English, deliberately.**
> A "reply in the user's language" rule was added to the system instruction on
> 2026-08-03, measured, and then **reverted** before the demo. Findings worth
> keeping:
> - Groq returns **no prose at all** alongside a tool call
>   (`finish_reason: tool_calls`, `content: undefined`), so the user-visible
>   sentence is *always* the service's synthesised English template
>   `` `I'd suggest ${name} — ${reason}` ``.
> - The rule works in a short prompt (the tool's `reason` came back in fluent
>   Turkish) but was ignored **6/6** through the real service prompt (7 rules +
>   8 injected place lines dilute it) on `openai/gpt-oss-20b`.
> - So the rule alone cannot produce a Turkish reply, and a Turkish `reason`
>   inside an English template reads worse than consistent English.
>
> A proper fix needs both a localised template **and** a reliably localised
> `reason` (a larger model, e.g. `openai/gpt-oss-120b`, is the cheapest lever —
> `GROQ_MODEL` is env-only). Left for after the demo.

### Final polish pass (2026-08-03, later same day)

**🔴 Fixed a real 500 — `ReferenceError: name is not defined`.**
`OverpassClient.fetchNearbyTags` takes `_name`, but its catch block logged
`${name}`. TypeScript did not catch it because no `lib` is set in
`pathwise-backend/tsconfig.json`, so `name` resolved to the DOM global
`window.name`; in Node it does not exist. Effect: **whenever the Overpass call
failed, the error handler itself threw**, and
`GET /api/places/:placeId/enrichment` returned **HTTP 500** instead of
degrading to `null`. Four of the six allowlisted landmarks (Blue Mosque,
Basilica Cistern, Grand Bazaar, Galata Tower) were 500ing — i.e. the Local
Story "Live details" panel was broken for them. This is also the most likely
cause of the long-standing flakiness of the enrichment e2e test.

After the one-word fix, all six return **200 with both `wikipedia` and `osm`
populated**, and a non-allowlisted place (`saltgalata`) correctly returns 200
with nulls.

### Turkish consistency of the Local Story panel — ✅ already Turkish
- `WikipediaClient` queries **`tr.wikipedia.org`**, so titles and summaries come
  back in Turkish ("Ayasofya", "Galata Kulesi", full Turkish summary text).
- The panel chrome is fully `t()`-driven (title, source, hours, cuisine,
  wheelchair labels), so it follows the EN/TR toggle.
- Remaining English is source data, not chrome: OSM `openingHours`
  (`Mon–Sun 09:00–19:30`) and `cuisine` tags. Judged acceptable — that is raw
  OpenStreetMap data.
- Wikipedia enrichment is limited to a **6-place allowlist** by design
  (`WIKI_TITLES`); other places show OSM-only or nothing. Not a fault, but worth
  knowing which stops to open during a demo.

### Final screen sweep — ✅ 7/7 clean
Landing · SignUp · Dashboard · AI assistant window · **Local Story modal** ·
Social · Profile — checked for console errors, uncaught errors, 5xx responses,
broken images, and text leaking `undefined` / `NaN` / `[object Object]` / raw
i18n keys. **All clean.** The Local Story modal now reaches the "Live details"
heading in the browser, confirming the enrichment fix end-to-end. The
SafetyPreferences panel rendered normally (not its boundary fallback).

### Regression
`npm run e2e`: **43/43** (42 passed + 1 flaky, passed on retry — the check-in
composer, a known timing-sensitive spec). Backend `npm test`: **39/39**.
`nest build` and `tsc --noEmit`: clean both sides.

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

## Reward points (Görev 1 — 2026-08-04)

Points accrue on four actions and are shown on the profile. **Accrual only —
there is no reward catalogue and nothing to spend them on yet**, which the UI
says out loud (`points.whatForBody`); the backend keeps a `point_transactions`
ledger so a real discount/perk system can be built on the balance later.

| Action | Points | Where it is granted |
|---|---|---|
| Reserve a tour/activity | 25 | `POST /analytics/affiliate-click` (the existing A7 click record) |
| Referral redeemed | 50 **to both sides** | `ReferralService.redeem` |
| Finish a day's route | 30 | `POST /points/route-completed`, max once/day |
| Review a place | 15 | `ReviewsService.create`, **first review only** |

Two guards worth knowing about, both deliberate and both narrow:
- **Route completion is throttled per calendar day (UTC)**, because completion
  is detected in the browser and the endpoint is therefore reachable at will.
  A declined award answers `200 { awarded: 0 }`, not an error, so the client
  just skips the toast. Real per-itinerary idempotency is a `TODO(idempotency)`
  in `points.service.ts` — it needs the itinerary to exist server-side, which
  it does not yet.
- **Reviews are an upsert**, so editing a review must not re-earn; only the
  insert path awards.

### Backend unit tests — 51/51 (was 39)
`points.service.spec.ts` adds **12 tests**: the award/ledger/balance path, the
`isSameUtcDay` boundary cases (same day, across UTC midnight, same day-number
in different months), and the throttle's edges — declined award writes no
ledger row, an unrelated action today does not block a completion, yesterday's
completion does not, and the throttle is per user rather than global.

### Live API run against the running stack (2026-08-04) — 8/8 as designed
| # | Step | Result |
|---|---|---|
| 1 | fresh account | `0` |
| 2 | reserve a tour | `+25` → total 25 |
| 3 | complete a route | `+30` → total 55 |
| 4 | complete again, same day | `+0` → total 55 (throttled, no error) |
| 5 | first review | `pointsAwarded: 15` |
| 6 | edit the same review | `pointsAwarded: 0` |
| 7 | `GET /users/me` | `points: 70` — balance and ledger agree |
| 8 | ledger contents | 3 rows, each carrying its reference (`gyg-101`, `hagiasophia`) |

Referral was driven separately with two accounts: B redeems A's code →
**both** sides land on 50, a second redemption is refused
("You have already used a referral code") and awards nothing further.

### E2E — `e2e/points.spec.ts` (3 new specs)
Zero balance + the honest "what are points for?" copy; the earn list rendered
from the **server's** price list (25/50/30/15); and reserving a tour →
`+25 points earned` toast → profile balance 25 with the award itemised.

> Selector note: dnd-kit renders its own empty `role="status"` live region on
> the dashboard, so a toast assertion must match on text, not on the role.

### Not covered
- No spec drives the **route-completion → points** path end-to-end (it needs
  every stop ticked off; the award is covered by the unit tests and the live
  API run above).
- Leaving a review awards points but shows **no toast** — only the Reserve
  button does, per the feature request. The points still appear on the profile.

### Full regression after Görev 1 (2026-08-04) — ⚠️ RETRACTED, see 2026-08-11
> ~~`npx playwright test`: **51 tests, all passed, 0 flaky**.~~
>
> **This line was never true and was never observed.** The command was piped
> through `tail`, so the exit code read back was *tail's* (always 0) and the
> captured output was empty. Two of the four specs added that day had in fact
> been failing since the moment they were written. Corrected below.

Backend `npm test`: **51/51** (this figure was read from Jest's own summary
and is accurate). `nest build` clean; frontend `npm run lint` 0 errors.
The `tsc --noEmit` claim is retracted separately — see the note below.

---

## Buddy matching, data enrichment and toolchain (2026-08-11)

Covers the eight commits made after Görev 1 that had never been logged here,
plus a hygiene pass that closed the gate.

### Two corrections to earlier entries in this file

**1. "`tsc --noEmit` clean both sides" was meaningless on the frontend.**
The root `pathwise/tsconfig.json` is solution-style (`"files": []` plus project
references), so `tsc --noEmit` type-checked **zero files**. Proven by putting
`const x: number = "not a number"` in `Social.tsx` — it passed. Every
"type-check clean" note dated on or before 2026-08-04 therefore says nothing
about the frontend. Build mode (`tsc -b`) is what walks the references; it is
now `npm run typecheck`, is a named CI step, and the tree is genuinely clean
under it. The backend's own config is a normal one, so backend `tsc --noEmit`
figures were always real.

**2. The 2026-08-04 e2e figure was retracted** (see above): piping through
`tail` returned tail's exit code, so a red suite read as green.

> **Lesson worth keeping:** never read a test result through a pipe. Redirect
> to a file and capture `$?` from the command itself, or read the reporter's
> own summary line.

### Feature work

| Feature | Status | Notes |
|---|---|---|
| **Buddy compatibility score** (`social/domain/matching.ts`) | ✅ | pure weighted sum: styles 50, hubs 30, budget 20; **20 unit tests**; 5-step live API run |
| Ranking on `GET /social/travelers` | ✅ | filters run first and are untouched; ranking only reorders |
| Missing-data handling | ✅ | components are skipped and weights renormalised; a viewer with nothing to compare gets `null`, and the UI shows no percentage rather than a fabricated one |
| **Travel styles** — quiz auto-fill + manual picker | ✅ | live API: quiz derives 3 tags, picker removes one, invalid tags and `#SoloVerified` refused |
| Match score UI on buddy cards | ✅ | was ⚠️ (API-only) until 2026-08-11; now driven in a browser by `presence-matching.spec.ts` |
| **Traveler seed 5 → 14** | ✅ | built to exercise the scorer: every hub preferred by ≥2, every tag on ≥3, all budget levels at every hub; **6 new specs guard that spread** so demo data cannot quietly stop being able to separate the list |
| Check-in feed 7 → 13, with real `createdAt` | ✅ | resolved against the clock at fetch time; the stored `minutesAgo` had frozen the feed |
| Community routes 4 → 10, tours 6 → 11, 3 new forum threads | ✅ | routes now cover every hub twice — "Clone this route" hands a hub to the dashboard, so a hub with no route was unreachable |
| Women-traveler specs rewritten to derive from the seed | ✅ | they asserted hardcoded id lists, which growing the demo data would have broken |

### Toolchain — three checks that were reporting success without working

| Check | Was | Now |
|---|---|---|
| Frontend types | checked 0 files | `npm run typecheck` (`tsc -b`), CI step, clean |
| Backend `lib` | unset → DOM globals type-checked in Node code (the root cause of the old Overpass 500) | `"lib": ["ES2021"]`; tree clean without the DOM |
| Backend lint | permanently red on one unused import, so exit codes meant nothing | **0 errors**; `no-unused-vars` taught the `_` prefix convention the code already used |
| Translations | a missing key silently ships English, or the raw key | `npm run i18n:check` fails the build; **350 keys**, both languages |
| CI | `on.push.branches: [main]` while the branch is `master`, and no PRs → **CI had never run** | triggers on `master`; both jobs lint; frontend also typechecks and i18n-checks |

### Fixed: the women-traveler specs never passed
Four faults, all in the test, none in the product — see commit
`test(e2e): fix the women-traveler specs, which never passed`. The most
interesting one: the spec expected the 🚺 chip to enable on the declaration
alone, but the reciprocity rule requires a switch as well. **The app was right
and the test was wrong**, which is the opposite of how it was recorded.

### Fixed: a CORS/host mismatch that failed 49 of 50 specs
Moving the Playwright base URL to `127.0.0.1` (to dodge a stale WSL relay on
one machine) left `CORS_ORIGINS` allowing only `localhost`, so every sign-up
was blocked and the suite read as a total wipeout. `CORS_ORIGINS` now allows
both spellings, and the committed base URL is back on `localhost` for CI
parity — the IPv4 workaround lives only in an untracked local `.env`.

> **Environment note (2026-08-11):** on this Windows host, `localhost` resolves
> to `::1` first and the WSL port relay went stale across a multi-day sleep —
> containers healthy, every `localhost` request dead, `127.0.0.1` fine.
> Diagnose with `curl http://127.0.0.1:3000/api/health`; fix by restarting
> Docker Desktop, or work around it locally with `E2E_BASE_URL` plus a matching
> `VITE_API_URL` in your own `.env`.

### Regression — 2026-08-11
| Suite | Result |
|---|---|
| **E2E `npx playwright test`** | ✅ **50/50 passed, 0 flaky** — `PLAYWRIGHT_EXIT=0`, read from Playwright directly (54.6 s) |
| Backend `npm test` | ✅ **78/78**, 8 suites (was 39 before Görev 1) |
| Backend `lint` / `tsc --noEmit` / `nest build` | ✅ all exit 0 |
| Frontend `typecheck` / `lint` / `i18n:check` | ✅ exit 0 / 0 errors (2 pre-existing warnings) / 350 keys |

### CI — running for the first time (2026-08-11)
The workflow had **never executed once** (`total_count: 1` after this push):
it triggered on `main` while the branch is `master`, and no PR was ever
opened. After the fix it ran on push and went **green on all three jobs** —
Backend, Frontend (lint + typecheck + i18n + build), and E2E against the full
docker stack. Run: `6d13741`.

> **It caught a regression on its very first run, which is the point.**
> The preceding commit documented `AUTH_THROTTLE_LIMIT` by pinning it to the
> production value of 10. `.env.example` is copied verbatim into `.env` by CI,
> so that overrode compose's dev default of 100 and capped the auth endpoints
> at 10 req/min — and the E2E suite registers a fresh account per spec.
> Reproduced locally before fixing: at limit 10, registrations 1–10 return 201
> and 11–15 return **429**. The example now carries the dev value with the
> production caveat in the comment, as `DB_SYNCHRONIZE` already does.
>
> Note the symptom: throttling surfaces as **every sign-up timing out**, not as
> a visible 429 — the same shape as the earlier CORS failure that took out 49
> of 50 specs. Two different causes, one symptom; measure before concluding.
>
> A local gate cannot catch this class of bug: a developer's own `.env`
> predates the change, so only CI's `cp .env.example .env` exercises it.

---

## Görev 3 — "🟢 available now" presence (2026-08-11)

A liveness layer over check-ins: a traveler stays marked available for
**2 hours** after checking in, then fades to "checked in earlier".

| Piece | Status | Notes |
|---|---|---|
| `utils/presence.ts` — the rule | ✅ | pure, framework-free, `now` is a parameter; `PRESENCE_WINDOW_MINUTES` is the single tuning point |
| Live/stale badge on feed cards | ✅ | e2e asserts **both** states are on screen |
| Check-in map on the Social page | ✅ | its own small Leaflet map, not an overlay on the dashboard's route map |
| Pulsing pins for live, static for stale | ✅ | e2e asserts both pin classes exist |
| Composer check-in reads as live at once | ✅ | e2e |

**Design notes worth keeping**
- **No WebSocket, deliberately.** Presence here means "posted a check-in
  recently" — a fact about a timestamp, not a live connection. A socket would
  imply a precision the feature does not have: a check-in says where someone
  *was*. Comparing against a window keeps the promise honest.
- **The UI never claims to know where anyone is.** Copy stays in the "posted
  from" register and the map carries an explicit "nobody's location is
  tracked" line. This is not a tracker and must not grow into one by accident.
- **Live vs stale differs in motion, size AND opacity** — never colour alone,
  so the distinction survives for viewers who cannot separate the two hues.
  `prefers-reduced-motion` drops the animation and keeps the other two.
- Check-ins now reference a real `placeId` instead of a free-text place name;
  the label and the map pin are the same fact read twice, and a check-in can
  no longer point at a place that does not exist. Two seed entries referenced
  places absent from the dataset (Fener Greek School, Süleymaniye) and were
  repointed at real ones.
- Presence is recomputed per render rather than stored — a cached flag would
  go stale exactly when it matters.

### Closed: the ⚠️ matching-UI gap
`e2e/presence-matching.spec.ts` now drives the two surfaces that were
API-verified only: a new account shows **no** percentage (the UI must not
invent one) and is nudged to add styles; picking `#Foodie` in the profile
makes the buddy list rank, show a "% match", and put the best match first.

---

## Check-ins: mock → real persistence (2026-08-11)

The check-in flow already worked; what it lacked was **persistence**. A posted
check-in lived in React state and vanished on reload. It is now a vertical
slice: entity + migration + repository + service + `GET`/`POST` endpoints, with
`api.ts` calling the real API and the frontend mock deleted.

| Piece | Status |
|---|---|
| `check_ins` table + migration `1730000003000-CreateCheckIns` | ✅ |
| `GET /api/social/check-ins` — seed ∪ persisted, newest first | ✅ |
| `POST /api/social/check-ins` — author from the JWT | ✅ |
| `api.getCheckIns()` / `api.createCheckIn()` wired; `CHECK_INS` mock deleted | ✅ |
| Görev 3 presence untouched | ✅ seed `createdAt` still derived from a relative offset at read time; real rows use the DB timestamp |

**Decisions, and why**
- **Place names resolve on the client, not the server.** The backend's place
  dataset holds 28 of the frontend's 41 places — four check-in locations are
  missing from it. Resolving server-side would leave those nameless and
  unpinned, so the API returns `placeId` and the client resolves against
  `hubData`. (The dataset divergence is pre-existing and left alone.)
- **The seed is merged, not replaced.** Its authors are demo travelers with no
  user accounts, so a persisted-only feed would be empty for a fresh account
  and presence would have nothing to distinguish. Same pattern as
  `traveler.dataset.ts`.
- **`avatarColor` is derived from the user id**, not stored — it is
  presentation, and a column would mean a migration plus a default for every
  existing row. Deterministic, so the feed does not flicker between reloads.
- **`authorName` is denormalised** at write time: the feed is a historical
  record and should keep saying who posted after a rename or a deletion.
- **The composer still collects only a message.** Adding a place picker would
  be a new feature; `placeId`/`hub` are null, so such a check-in shows in the
  feed and not on the map rather than being pinned at a guessed location.

### Persistence proved, not assumed — live API run (8/8)
"POST returned 201" is not evidence that anything was stored, so each step
re-reads through a separate request:

| # | Step | Result |
|---|---|---|
| 1 | feed before | 13 seed, 0 real |
| 2 | POST a check-in | `201` |
| 3 | **separate GET** | **found** — author from the JWT, `placeId: null` |
| 4 | ordering | top of the feed (newest `createdAt`) |
| 5 | seed survives | 14 total = 13 seed + 1 real |
| 6 | **re-login, new token** | still there |
| 7 | a *different* user's GET | sees it — the feed is shared |
| 8 | body carrying `userId`/`traveler` | **`400 Bad Request`** — rejected outright, not silently stripped |

Step 8 is stronger than expected: the global `ValidationPipe` forbids
non-whitelisted properties, so a spoofed author cannot even be ignored — it is
refused. Combined with step 3, the "author comes from the session" rule holds
from both directions.

### E2E — `a posted check-in survives a full page reload`
Posts, **reloads the page** (so nothing survives in memory), and asserts the
message is back from the database, marked live, and above the newest seed
entry, with the seed still present.

> **First version of this test was flaky and the assertion was wrong, not the
> feature.** It asserted an exact row count (`seedRowsBefore + 1`) and failed
> 15 vs 16 — the feed is *shared*, so a parallel spec posting its own check-in
> legitimately changes the count and who is literally first. Rewritten to
> assert relative position and membership. Anything asserting a global count
> on this feed will flake under `fullyParallel`.

### Regression — 2026-08-11 (after this change)
| Suite | Result |
|---|---|
| **E2E** | ✅ **55 tests: 54 passed, 1 flaky, 0 failed** — `PLAYWRIGHT_EXIT=0` |
| Backend `npm test` | ✅ 78/78 |
| Backend lint / tsc | ✅ exit 0 |
| Frontend typecheck / lint / i18n | ✅ exit 0 / 0 errors / **359 keys** |

The flaky one is `social-features.spec.ts:70` (poll winner → Today's Path),
recorded as timing-sensitive since 2026-08-02 and unrelated to check-ins.

---

## Forum answers + route likes: mock → real (2026-08-11)

Both behaviours already worked and neither survived a reload. Same vertical
slice as check-ins, plus one thing check-ins did not have: **a toggle**.

| Piece | Status |
|---|---|
| `forum_answers` + `route_likes` + migration `1730000004000` | ✅ |
| `GET /social/forum`, `POST /social/forum/:questionId/answers` | ✅ |
| `GET /social/community-routes`, `PUT`/`DELETE .../:id/like` | ✅ |
| `api.ts` swapped; `FORUM_QUESTIONS` and `COMMUNITY_ROUTES` mocks deleted | ✅ |
| Clone-this-route untouched | ✅ it only reads `hub` → localStorage → dashboard; no contact with likes |

**Scope, deliberately narrow**
- **Questions stay seed-only, answers persist.** There is no "ask a question"
  UI, so persisting questions would be adding a feature, not making one
  durable. Same for routes: no "publish a route" UI, so only the *liking*
  got a table.
- Both merge seed with persisted at read time, as check-ins do, so a fresh
  account never opens onto an empty forum.

**Likes: a toggle, not a tally**
- `UNIQUE(userId, routeId)` is the guarantee, not a nicety — it is what makes
  "one like per person" true rather than intended.
- The write is `PUT` + `DELETE`, **not a toggling `POST`**. Both are
  idempotent, so a retry or a double-fire cannot inflate the count or silently
  undo a like. Insert uses `ON CONFLICT DO NOTHING`, so two simultaneous likes
  cannot both land — no read-modify-write race.
- **The count is derived on every read**: `seedLikes + COUNT(route_likes)`.
  Nothing anywhere increments a stored total, so it cannot drift from the rows
  behind it. `seedLikes` is static demo data and is never written to.

> A toggling POST would have made the "like twice → count unchanged" test pass
> for the wrong reason: the second call would *unlike*, and the count would
> return to where it started. PUT keeps it at one like, which is what the test
> is actually meant to prove.

### Live API run — 16/16
Forum: answer persisted into **q1 only** (verified it leaked into no other
thread), seed answers intact (18 → 19), author taken from the JWT, unknown
thread → `404`.

Likes, on `r1` (seed baseline 128):

| Step | likes |
|---|---|
| start | 128, `liked: false` |
| A likes | 129 |
| **A likes again** | **129** — idempotent |
| A likes a third time | **129** |
| B likes | 130 |
| A unlikes | 129 |
| **A unlikes again** | **129** — idempotent |
| separate GET as B | 129, `B.liked: true` |
| unknown route | `404` |

### E2E — `e2e/social-persistence.spec.ts` (2 specs)
Both **reload the page** before asserting. The forum spec checks the answer
returns, sits in its own thread, has not leaked into another, and that the
seed answers are still beside it. The like spec checks the like and the count
survive a reload, that liking again via the API leaves the count unchanged,
and that taking the like back returns the count to where it started.

> **These surfaces are shared**, so the specs assert *this user's* own
> contribution and the deltas it causes — never a global count or "is first",
> and they deliberately use a thread and a route that `social-features.spec.ts`
> does not touch, so parallel workers cannot collide. This is the same lesson
> the check-in persistence spec learned the hard way.

### Regression — 2026-08-11 (after this change)
| Suite | Result |
|---|---|
| **E2E** | ✅ **57 tests, 57 passed, 0 flaky** — `PLAYWRIGHT_EXIT=0` (1.6 m) |
| Backend `npm test` | ✅ 78/78 |
| Backend lint / tsc | ✅ exit 0 |
| Frontend typecheck / lint / i18n | ✅ exit 0 / 0 errors / **360 keys** |

---

## Redis removed (2026-08-11)

Dropped entirely: the client, the module, the config, the compose service and
the volume. It was going to cost money (or an unreliable free tier) on the
hosting this deploys to, and its work split cleanly in two.

| What Redis did | Where it went |
|---|---|
| Refresh-token store (rotation + revocation) | **Postgres** — `refresh_tokens`, migration `1730000005000` |
| Caches: currency, weather, place enrichment | **In-process** `MemoryStoreService` |
| Quotas: assistant chat, optimize limit, paywall tallies | **In-process** `MemoryStoreService` |
| Global HTTP throttler | *nothing to do* — `ThrottlerModule` never used Redis; it was always in-memory |

The nine consumers only ever touched a **six-method facade**
(`setWithTtl / get / del / exists / increment / getCount`), and `ioredis` was
imported by exactly two files. So the swap was an implementation change, not a
rewrite: consumer logic is untouched.

> ### ⚠️ Single-instance by design — a documented trade, not hidden debt
> In-process cache and quotas are **correct for one instance**. Run two and
> each keeps its own: the caches merely get less efficient (survivable), but
> **the quota counters become wrong** — an hourly cap of N turns into N *per
> instance*. Restarts also reset both, which is harmless (caches re-fetch,
> quotas reset in the user's favour, and every cached call already has a
> fallback).
>
> **The trigger to revisit is scaling past one instance**, not time passing.
> At that point the quota counters need a shared store again; the facade is
> narrow precisely so that stays a one-file change. Refresh tokens are *not*
> affected — they are in Postgres and already multi-instance safe.

### What got better, not just cheaper
- **Sessions now survive a backend restart.** In Redis they did not — on a
  free tier that sleeps, that meant silent logouts. Verified below.
- **The hang risk is gone.** `maxRetriesPerRequest: null` made ioredis queue
  commands forever when Redis was unreachable, so `/auth/register`,
  `/currency/rates` and `/weather` *hung* rather than failing — and the
  `try/catch` degradation those services appear to have never fired, because
  nothing threw. With no client, there is nothing to hang.
- Postgres has no TTL, so `expiresAt` is explicit and checked on every
  validation; the repository prunes a user's expired rows when it writes a new
  one, avoiding a scheduler.

### Verification against the Redis-free stack
`docker compose up -d --build` with **three** services (postgres, backend,
frontend) — the orphaned `pathwise-redis` container was removed too.

| # | Check | Result |
|---|---|---|
| 1 | app boots with no Redis anywhere | ✅ clean boot, 0 errors |
| 2 | register → refresh → logout → refresh → login | ✅ `201` → `200` → `204` → **`401`** (revocation works) → `200` |
| 3 | `refresh_tokens` table real and populated | ✅ correct columns, unique `(userId, jti)`, rows present |
| 4 | **login → restart backend → refresh** | ✅ **`200`, new access token** — the session survived |

> Two probe mistakes worth recording, because both looked like product bugs:
> the first logout probe sent only the cookie and got a `401` (logout needs the
> access token too), and the first restart probe called refresh *before*
> restarting without saving the rotated cookie, so it presented an
> already-revoked token afterwards. Both were fixed and re-run; neither was the
> app.

### Regression — Redis-free stack
| Suite | Result |
|---|---|
| **E2E** | ✅ **57/57, 0 flaky** — `PLAYWRIGHT_EXIT=0` (1.4 m) |
| Backend `npm test` | ✅ 78/78 |
| Backend lint / tsc | ✅ exit 0 |
| Frontend typecheck / lint / i18n | ✅ exit 0 / 0 errors / 360 keys |

---

## Deploy readiness — single-origin production build (2026-08-12)

Repo-side only; the actual deploy is done from the Render dashboard.

**One service, not two.** The production image serves the API under `/api` and
the built SPA at everything else. This is a requirement, not a preference: the
refresh token is an httpOnly `SameSite=Lax` cookie, and Safari, Firefox and
Brave block that cookie on cross-site requests — a split origin would log
users out every 15 minutes on exactly the phones this is aimed at.

| Piece | Where |
|---|---|
| Production image | **new root `Dockerfile`** — builds SPA → builds API → lean runtime |
| Static serving + SPA fallback | `ServeStaticModule`, registered **only when `client/index.html` exists** |
| Migrations on boot | `npm run migration:run:prod && node dist/main.js`, `DB_SYNCHRONIZE=false` |
| Blueprint | `render.yaml` — one web service + free Postgres, no Redis, no static site |

**Dev and E2E are untouched.** `pathwise-backend/Dockerfile` was deliberately
left alone, so docker-compose, hot reload and the two-origin E2E topology work
exactly as before. The static handler returns nothing in dev because there is
no `client/` directory.

### Two traps found while building it
- **`npm run migration:run` cannot run in the production image.** It starts
  with `nest build`, and `@nestjs/cli` is a devDependency that `npm prune
  --omit=dev` removes. Added `migration:run:prod`, which runs the migration
  against the already-built `dist/`.
- **`npm ci` died with npm's "Exit handler never called"** in the client
  stage. Cause: `@playwright/test` is a devDependency whose postinstall pulls
  ~150 MB of browsers. Fixed with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` — the
  image builds the SPA, it never tests it.

### The production path was actually run, not just compiled
Image built (`DOCKER_BUILD_EXIT=0`, 385 MB) and run against Postgres:

| Check | Result |
|---|---|
| `/social` direct hit | **200, `text/html`**, contains the SPA root div |
| `/profile`, `/premium`, `/auth`, `/dashboard` | **200** each |
| `/api/health`, `/api/places` | **200** |
| **`/api/nope`** | **404 `application/json`** — the `exclude` works; API 404s are not swallowed into `index.html` |
| register | **201**, cookie `pw_refresh` set `HttpOnly`, path `/api/auth`, `secure` |
| refresh with that cookie | **200** |

> That `/api/nope` row is the one worth keeping. Without `exclude`, the
> catch-all answers unmatched API routes with `index.html`, and the client
> fails with "Unexpected token <" instead of a readable error.

**Auth code was not touched** — that is the whole point of single-origin. The
cookie stays `SameSite=Lax` and first-party. Verified: no diff under
`src/modules/auth/`.

### Also changed
- `main.ts` reads `PORT` before `BACKEND_PORT` (managed hosts assign `PORT`),
  which removed a fragile self-referencing `fromService` from `render.yaml`.
- `DB_SSL` flag on both `DatabaseModule` and the migration `data-source`,
  defaulting off. Managed Postgres usually needs TLS with
  `rejectUnauthorized: false`; this is the first thing to flip if the deployed
  service cannot reach its database.
- `CORS_ORIGINS` is declared but unset — same origin means CORS is never
  exercised. `enableCors` stays in `main.ts` because **local dev is still two
  origins** (5173 ↔ 3000) and the E2E suite depends on it.

### Regression — deploy-readiness round
| Suite | Result |
|---|---|
| **E2E** | ✅ **57 tests: 56 passed, 1 flaky, 0 failed** — `PLAYWRIGHT_EXIT=0` (2.0 m) |
| Backend `npm test` | ✅ 78/78 |
| Backend lint / tsc | ✅ exit 0 |
| Frontend typecheck / lint / i18n | ✅ exit 0 / 0 errors / 360 keys |

The flaky one is `social-features.spec.ts:70` (poll winner), recorded as
timing-sensitive since 2026-08-02 and unrelated.

---

## Deploy failure: the schema had no migrations (2026-08-12)

The first Render deploy died at startup:
`42P01 relation "users" does not exist`, from
`AddSubscriptionTierToUsers1730000000000`.

### Root cause — measured, not guessed
Entities define **18 tables**. Migrations created **5**. The remaining
**13 — including `users`** — had never had a migration at all; they only ever
existed because dev runs `DB_SYNCHRONIZE=true` and TypeORM built them from the
entities.

So the migration list opens with `ALTER TABLE "users"` against a database
where nothing has created `users`. Locally that ALTER succeeded on a table
synchronize had already made, which is precisely why six migrations could be
written, reviewed and pushed without anyone noticing the base was missing.

Reproduced on an empty local database with synchronize off — the identical
error, on the very first migration, transaction rolled back.

### Fix
`1729999000000-CreateBaselineSchema` — dated **before** the existing six so a
clean database builds the base first. It creates `users` in its
**pre-migration shape**: no `subscriptionTier`, no women-traveler preferences,
no `points`, because the later migrations still add those and should keep
saying when each arrived. (`trialEndsAt` is in the baseline — no migration
ever added it.) Every statement is `IF NOT EXISTS`, so a dev database that
already recorded all six runs it afterwards as a harmless no-op.

### Verified on a genuinely empty database
| Check | Result |
|---|---|
| `npm run migration:run` from empty | ✅ **7/7 executed**, exit 0, 0 errors |
| Resulting tables | ✅ **18**, exactly the entity set |
| `users` columns | ✅ all 15 — baseline + the three later migrations |
| **`npm run migration:run:prod`** (the exact command Render runs) from empty | ✅ exit 0, 7 applied, 19 tables |
| App boots with `DB_SYNCHRONIZE=false` on that schema | ✅ health 200, **register 201**, places 200, check-ins 401 (auth required) |
| Rows actually written | ✅ 1 `users`, 1 `refresh_tokens` |

> `register` is the assertion that matters: it inserts into `users` *and*
> `refresh_tokens`, so it exercises the baseline and the newest migration in
> one call.

### Render's database needs no cleanup
The failed run left it **effectively empty**: TypeORM creates its `migrations`
bookkeeping table outside the transaction, then rolls back the failed
migration. Confirmed locally — after the failure the database held exactly one
table (`migrations`) with **zero rows**. So the next deploy starts from a clean
slate and applies all seven. No manual reset needed.

### Prevention
CONTRIBUTING now documents the trap and gives the empty-database verification
command. The rule: **a dev database can never validate a migration set**,
because synchronize has already built everything and every statement is
`IF NOT EXISTS`.

### Regression after the fix
| Suite | Result |
|---|---|
| **E2E** | ✅ **57/57, 0 flaky** — `PLAYWRIGHT_EXIT=0` (1.4 m) |
| Backend `npm test` | ✅ 78/78 |
| Backend lint / tsc | ✅ exit 0 |

### ⚠️ Environment finding: a new backend dependency needs a container rebuild
Adding `@nestjs/serve-static` on the host silently produced a **stale gate**.
The compose backend bind-mounts only `./pathwise-backend/src`; `node_modules`
lives in the image. So the watcher tried to recompile, failed to resolve the
new package, and **kept the last good process running** — the API answered
`200` throughout, and an E2E run reported 2 unrelated-looking failures while
in fact never executing the changed code at all.

Symptom to recognise: `docker compose ps` shows a long uptime with no restart
after a source change, and `docker exec pathwise-backend ls node_modules/@nestjs`
is missing the package. Fix: `docker compose up -d --build backend`.

> This is the same class of trap as the 2026-07-27 Tailwind config drift: the
> container silently disagreeing with the repo. **After adding any backend
> dependency, rebuild before trusting a test run.**

### Still not covered
- ~~No spec asserts the "% match" bar or the travel-style picker~~ — **closed
  2026-08-11**, see the Görev 3 section.
- ~~Görev 3 is not started~~ — **done 2026-08-11**.
- No spec drives **route completion → points** end-to-end (unit tests + a live
  API run cover the award itself).
- The presence window is never crossed *during* a test: the seed provides both
  states, but nothing asserts that a live check-in becomes stale after two
  hours. `isLive` takes `now` as a parameter precisely so that is testable —
  it needs a unit-test runner on the frontend, which does not exist yet.
- Four specs were flaky under heavy parallel load in an earlier run
  (`survival widget`, `weather widget`, `time anchor`, `poll winner`); all
  passed first-try in the clean run.

---

## Place expansion: 5 hubs / 28 places → 10 hubs / 124 places (2026-08-12)

Seeded from a 129-place curated input (`scripts/data/pathwise-places.json`).
The backend dataset is now the **single source of truth for both halves**; the
frontend's copy is generated from it.

| Before | After |
|---|---|
| 5 hubs | **10 hubs** |
| 28 backend places / 41 frontend places | **124, one dataset** |
| 6 `Interest` values | **14** |
| no place-type axis | `placeType` (11 values) |
| ticket prices unmarked | `entryFeeApprox` on every non-zero fee |

### Geocoding — what the plausibility check caught
Coordinates came from Nominatim via `scripts/geocode-places.mjs`, never by
hand. Two guards run on every hit: an Istanbul bounding box, and **distance
from the hub centre** (4 km default; 6 km Üsküdar, 9 km Ortaköy-Bebek, 12 km
Adalar). The second one is what actually works — **17 wrong coordinates were
rejected, 0 reached the dataset**:

| Query | Nominatim's answer | Caught by |
|---|---|---|
| Moda Sahili | **Bethlehem, Palestine** | bounding box |
| Aya Nikola Koyu | **Kırcaali, Bulgaria** | bounding box |
| Splendid Palas Oteli | **Samsun** (Gazi Müzesi) | bounding box |
| Tahtakale Çarşısı | **Bursa** | bounding box |
| Balık Pazarı (Beyoğlu) | **Yalova** | bounding box |
| Değirmen Tepesi | **Kırklareli** | bounding box |
| Yeni Cami | Beykoz, Kavacık | **hub distance** (11.8 km) |
| Gezi Parkı | Ümraniye | **hub distance** (13.6 km) |
| Kadıköy Vapur İskelesi | Bostancı İskelesi | **hub distance** (7.0 km) |
| Bahariye Caddesi | Beyoğlu, Şişhane | **hub distance** (6.7 km) |
| Galata Şarap Evi | Kadıköy, Viktor Levi | **hub distance** (5.9 km) |
| + 6 more | wrong district | hub distance |

A city-sized box alone would have passed 10 of these. **The box is the weaker
check; proximity to the hub is the one that finds a same-name mismatch.**

Two Nominatim behaviours worth knowing, both found by measurement:
- **Appending `, Istanbul` makes it fail.** It reads the comma as a structured
  address hint. `"Kadıköy Boğa Heykeli, Istanbul"` → nothing; bare
  `"Boğa Heykeli"` → exact hit. The script now walks a ladder of query forms
  (qualified → bare → parenthetical-stripped → district-stripped) and takes the
  first hit that survives the plausibility check.
- **`bounded=1` on the viewbox is too strict** — it returned nothing at all for
  real places like Nuruosmaniye Camii. The viewbox is now a soft bias only.

**9 places were dropped for lack of a trustworthy coordinate** rather than
given a guessed one: Seven Hills Restaurant Terası, Balık Pazarı (Beyoğlu),
Galata Şarap Evi, Karaköy Balıkçılar Çarşısı, Barbaros Hayreddin Paşa Anıtı,
Tarihi Beşiktaş Kumpircisi, Merdivenli Yokuş Sokak, Değirmen Tepesi, Aya Nikola
Koyu. They can be added later with hand-verified coordinates.

### Merge rules
- **37 places already existed** under a different-language name (Ayasofya /
  Hagia Sophia). Matched by a **hand-authored id map**, never fuzzy-matched —
  a wrong automatic match would silently overwrite a curated record. Their
  hand-written tips and verified coordinates are kept; the expansion only adds
  `placeType`, extra interests, and a hub reassignment where one applies.
- **4 curated places absent from the input were kept**, not deleted. Adding
  data should not silently remove any.
- **`rating` on the 83 new places is a flat 4.5 placeholder.** It feeds scoring
  as `rating * 10`, so an invented per-place spread would be an invented quality
  ranking. A constant makes interest overlap the only differentiator.

### `MAX_STOPS` — the engine change the data forced
Selection was bounded only by `paceHours`. With 5–6 candidates per hub that was
invisible (everything fit); with 12–15 it packs a 7-hour day with 10+ stops —
arithmetically valid, miserable to walk. Cap is now 3/5/7/8 by pace.
**Must-visits and reservations are exempt** — silently dropping a booked stop
would be a bug, not pacing. 6 new unit tests.

### Divergence is now a CI failure, and the check was verified to fail
`pathwise/src/hubData.ts` is generated by `scripts/sync-frontend-places.mjs`;
CI runs it with `--check`. **Proven, not assumed** — a place was deliberately
added to the backend dataset without regenerating:

| State | `--check` |
|---|---|
| clean | `✓ up to date (124 places, 10 hubs)` → **exit 0** |
| backend edited, artifact stale | `✗ hubData.ts is STALE` → **exit 1** |
| restored | exit 0 |

The artifact is a **projection** (id, name, hub, lat/lng, fee) — the only
fields the synchronous `PLACES_BY_ID` lookups read. Despite 124 places instead
of 41, `hubData.ts` shrank 43 KB → 23 KB and the bundle grew only 12 KB.

`api.getPlaces` / `getPlaceById` were deleted: no callers, and the copy they
served was the drifted one.

### Regression
| Suite | Result |
|---|---|
| **E2E** | ✅ **56 passed, 1 flaky, `PLAYWRIGHT_EXIT=0`** (1.3 m, clean stack) |
| Backend `npm test` | ✅ **84/84** (was 78) |
| Backend lint / build | ✅ exit 0 |
| Frontend lint / typecheck / i18n / build | ✅ exit 0 · 368 i18n keys |
| `sync-frontend-places --check` | ✅ exit 0 |

### ⚠️ Two e2e specs were passing *because of* the bug
`search bar finds a place` and `story modal shows enrichment` used
`getByRole('button', { name: /Hagia Sophia/i })`. That matched exactly one
result only because **Küçük Ayasofya existed solely in the frontend copy** and
never reached `/places/search`. Once the backend owned both, the locator matched
two buttons and tripped strict mode. Fixed by anchoring: `/^Hagia Sophia\b/`.

Worth recording as a category: *closing a data divergence can break tests that
were relying on the divergence.* The tests were wrong, not the new data.

### ⚠️ `nearby suggestion` — a read-then-click race the bigger dataset exposed
The spec read the suggestion label, then clicked Add. An effect refetches the
suggestion whenever the itinerary changes, so right after a regenerate the panel
still showed the **previous** plan's suggestion while a new request was in
flight — the test noted one place and added another. With 6 candidates per hub
the refetch usually returned the same place and it passed by luck; with 15 it
did not.

Root-caused by capturing the network trace, not by guessing — three fixes were
tried and measured before the right one:

| Attempt | Result |
|---|---|
| Scope label + button to the same panel element | still flaky — the element is the same, its *contents* change |
| `waitForResponse('/suggest-nearby')` | still flaky — matched the **page-load** plan's request, not the new one |
| `waitForLoadState('networkidle')` | still flaky — resolves in the gap between the generate response and the effect firing |
| **Don't regenerate at all** — use the plan built on load | ✅ exactly one suggestion is ever fetched, so label and action cannot disagree |

The app was correct throughout: a direct `/itinerary/rebuild` call with the
suggested id returns it in the stops, and the network trace showed the UI
faithfully rendering whatever it asked for.

### Still not covered
- `marking a review helpful` remains flaky (1 retry in the clean run). It was
  flaky before this round; not investigated.
- The 9 places without coordinates.
- Traveler/community-route seeds still only reference the original 5 hubs, so
  matching never scores against the 5 new ones.
- Everything in the previous "Still not covered" list below.

---

## Social layer catches up to 10 hubs (2026-08-13)

The place expansion left a hole one day old: the social seeds still only named
the original five hubs, so `matching.ts`'s HUB component (weight 30) scored
**0 for anyone whose trips were in the five new ones** — the ranking silently
fell back to style and budget alone. Nothing looked broken; the percentages
just meant less than they claimed.

### The test that should have caught it was blind
[`social.service.spec.ts`](pathwise-backend/src/modules/social/application/social.service.spec.ts)
already asserted *"covers every hub at least twice, so trip history separates
the list"* — against a **hand-copied list of the five original hubs**. A fourth
copy of the hub identifiers. It stayed green through the expansion because it
never thought to ask about the new hubs.

Now derived from `HUB_DATASET`. Verified the derivation actually bites, before
fixing the seed:

| State | `covers every hub at least twice` |
|---|---|
| HUBS derived, seed untouched | ❌ `Expected: >= 2, Received: 0` |
| after adding 10 travelers | ✅ |

Same lesson as `tsc --noEmit` and the CI branch filter: **a check restating
what it should be reading cannot notice the thing it exists to notice.**

### What changed
| Seed | Before | After |
|---|---|---|
| Travelers | 14, over 5 hubs | **24, all 10 hubs ≥2** |
| Community routes | 10, over 5 hubs | **21, all 10 hubs ≥2** |
| Check-ins | 13, over 6 hubs | **17, over 9 hubs** |

Existing records are untouched — the current match percentages are built on
those profiles, and the e2e specs name individual travelers (`Yuki Tanaka`,
`Diego Fernández`, `Liam O'Connor`). New travelers were appended instead.

`r10 "Ortaköy to Bebek waterfront"` was still filed under `besiktas-bogaz`, so
Clone handed the dashboard the wrong hub. Same stale-classification bug as the
check-in seeds fixed the day before. Beşiktaş gained a replacement route so no
hub is thinner than the rest.

New check-ins are pinned inside 9–239 minutes on purpose: the presence specs
assert the newest entry (8 min) is live and the oldest (240 min) is stale, so
an entry outside that range would move a boundary the tests depend on.

### The offline traveler copy is now generated too
`mockData.TRAVELERS` was a second hand-maintained copy, used only as the
offline fallback for `api.getTravelers` — the same divergence as places, just
somewhere nobody looks. It now lives in generated `pathwise/src/travelerData.ts`
and is covered by the same `--check`.

`visibleToWomenOnly` is deliberately **not** carried into the artifact: it is a
server-side reciprocal visibility rule the offline path cannot enforce, and a
client filtering on it would be guessing at a privacy decision.

### ⚠️ The freshness check crashed instead of checking — caught by the drift test
The first version of the extended `--check` referenced `existsSync` without
importing it. It exited 1, which *looks* like a working check. Both the clean
state and the drifted state failed, for the same wrong reason:

```
ReferenceError: existsSync is not defined
```

Only running the deliberate-drift procedure (clean → expect 0, drift → expect
1, restore → expect 0) surfaced it; a single run in either state would have
been read as success. **Exit 1 is not evidence a check works — the clean case
has to be observed passing too.**

### Regression
| Suite | Result |
|---|---|
| **E2E** | ✅ **56 passed, 1 flaky, `PLAYWRIGHT_EXIT=0`** (1.5 m) |
| Backend `npm test` | ✅ 84/84 |
| Backend lint / build | ✅ exit 0 |
| Frontend lint / typecheck / i18n / build | ✅ exit 0 |
| `sync-frontend-places --check` | ✅ exit 0 (124 places, 10 hubs, 24 travelers) |

Live API verified against the running stack rather than counted by eye:
19 travelers visible to a browsing account (24 minus 5 women-only), all 10
hubs represented, 21 community routes with no hub below 2.

### Still not covered
- `marking a review helpful` is still flaky (1 retry). Pre-dates this round.
- The 9 places without coordinates.
- Nothing asserts community-route or check-in hub coverage the way the
  traveler seed now does — those two seeds can still go thin unnoticed.

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
