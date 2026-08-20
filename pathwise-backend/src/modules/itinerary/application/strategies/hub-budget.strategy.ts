import { Injectable } from '@nestjs/common';
import { PlacesService } from '../../../places/application/places.service';
import { Hub, Place } from '../../../places/domain/place';
// Reaching into the places dataset for HUB_SIDE is deliberate. The alternative
// is a second copy of "which shore is this hub on" living in the itinerary
// module, and a hub added to one list but not the other is precisely how the
// engine ends up planning a walk across the Bosphorus.
import { HUB_SIDE } from '../../../places/infrastructure/persistence/hub.dataset';
import { haversineMeters, LatLng } from '../../domain/geo';
import {
  GroupType,
  Itinerary,
  ItineraryNotice,
  ItineraryStop,
  RouteGenerationInput,
  TransportLeg,
  WalkingTolerance,
} from '../../domain/itinerary';
import {
  ISLAND_LAST_FERRY_MIN,
  ISLAND_RETURN_BUFFER_MIN,
  planLeg,
  TransitPoint,
} from '../../domain/transit';
import { RouteGenerationStrategy } from '../../domain/route-generation-strategy.port';
import { normalizeWeekday } from '../../../places/domain/opening-hours';
import { respectOpeningHours } from '../../domain/opening-feasibility';

/**
 * HubBudgetStrategy — the core route engine.
 *
 * Pipeline:
 *   1. gather candidates (hub places + any must-visits from other hubs)
 *   2. score by interest match + rating + group fit
 *   3. greedily select within the time (pace) budget; must-visits are forced
 *      in and are NEVER dropped, even if the money budget is strained
 *   4. weather pass: on rain, swap outdoor non-must stops for indoor ones
 *   5. order by nearest-neighbour; push sunset spots to the end in the evening
 *   6. insert an automatic Lunch Break if the day spans midday
 *   7. compute transport legs, arrival/departure times and the cost breakdown
 *   8. trim the tail until the day actually fits the clock it was given
 *
 * Steps 7 and 8 are a loop, not a sequence. Travel time cannot be known before
 * the stops are ordered, so the day is assembled, measured, and shortened if it
 * overran — which is also how an island day is kept on the right side of the
 * last ferry home.
 */
@Injectable()
export class HubBudgetStrategy implements RouteGenerationStrategy {
  private static readonly LUNCH_START = 12 * 60; // minutes since midnight
  private static readonly LUNCH_END = 14 * 60;
  private static readonly LUNCH_DURATION = 45;

  /**
   * Stand-in score for a place nobody has rated. Deliberately mid-range: the
   * curated ratings run 4.3–4.8, so this neither promotes nor buries an
   * unrated place relative to them. It exists only inside scoring — no unrated
   * place ever shows a star in the UI.
   */
  private static readonly UNRATED_BASELINE = 4.5;

  /**
   * How hard the quiz answers lean on the shortlist.
   *
   * Both are calibrated against the levers already here: one interest match is
   * +25 and a strained-budget ticket is −15. So a familiarity bonus of +20
   * reorders places the traveller is equally interested in without ever
   * outranking an interest they actually named, and a −30 nightlife penalty is
   * enough to push a bar below a similar non-bar without erasing it.
   */
  private static readonly FAMILIARITY_BONUS = 20;
  private static readonly NIGHTLIFE_PENALTY_FOR_FAMILIES = 30;

  /**
   * How much walking a day may ask of someone who said they would rather not
   * walk far, and the floor that protects the day from the rule.
   *
   * Measured rather than picked: generated across thirteen hubs at three paces,
   * a day's walking legs run from 0 m to 2,828 m with the middle around a
   * kilometre. 1,500 m therefore leaves the ordinary day untouched and trims
   * the handful that are genuinely long — Eminönü at a packed pace (2,828 m),
   * Nişantaşı (2,146 m), Kadıköy and Balat (~1,560 m).
   *
   * Nişantaşı is also why this exists at all. At seven hours it plans six stops
   * against a cap of seven, so lowering the cap by one changes nothing there
   * while the day still asks for over two kilometres on foot. A stop cap alone
   * would have been a control that answers "how far can you walk?" by doing
   * nothing at all in about half the cases.
   */
  private static readonly SHORT_WALK_CEILING_METERS = 1500;
  private static readonly MIN_STOPS_AFTER_WALK_TRIM = 3;

  /**
   * Upper bound on real stops in a day, by pace.
   *
   * Until the dataset grew to 129 places this was unnecessary: a hub held five
   * or six candidates whose visit times summed to less than any sane pace
   * budget, so "everything that fits" and "everything" were the same set. With
   * twelve to fifteen candidates per hub the time budget alone will pack a
   * seven-hour day with ten or more stops — arithmetically valid and a
   * miserable day to actually walk. The cap is what keeps a plan human;
   * `paceHours` remains the binding constraint whenever it is the tighter one.
   *
   * Must-visits and reservations are exempt — the user asked for those
   * explicitly, and silently dropping a booked stop would be a bug, not pacing.
   */
  private static readonly MAX_STOPS_BY_PACE: ReadonlyArray<{
    upToHours: number;
    maxStops: number;
  }> = [
    { upToHours: 3, maxStops: 3 }, // "relaxed"
    { upToHours: 5, maxStops: 5 }, // "moderate"
    { upToHours: 7, maxStops: 7 }, // "packed"
    { upToHours: Infinity, maxStops: 8 },
  ];

  /**
   * The fewest stops a day is allowed to be cut to by walking tolerance. Below
   * three there is no day left to plan, only an errand.
   */
  private static readonly MIN_STOPS_WHEN_WALKING_IS_HARD = 3;

  private static maxStopsFor(
    paceHours: number,
    walkingTolerance?: WalkingTolerance,
  ): number {
    const byPace =
      HubBudgetStrategy.MAX_STOPS_BY_PACE.find((b) => paceHours <= b.upToHours)
        ?.maxStops ?? 8;

    // Fewer stops is the honest lever for "I would rather not walk far". The
    // walking in a day is mostly the hops between stops, and the engine has
    // already committed to a hub by this point, so dropping a stop removes a
    // hop; nothing else here can shorten one. Only the low answer moves the
    // cap — 'moderate' and 'long' leave the day exactly as it was, and so does
    // the question going unanswered.
    return walkingTolerance === 'short'
      ? Math.max(HubBudgetStrategy.MIN_STOPS_WHEN_WALKING_IS_HARD, byPace - 1)
      : byPace;
  }

  constructor(private readonly places: PlacesService) {}

  async generate(input: RouteGenerationInput): Promise<Itinerary> {
    const hub = input.hub ?? 'kadikoy-moda';

    // 1 — candidate pool: hub places + must-visits from anywhere.
    // Reserved stops are treated like must-visits: a booking means you're going,
    // so they're force-included and never dropped for budget/pace.
    const reservedIds = (input.reservations ?? []).map((r) => r.placeId);
    const forcedIds = [...input.mustVisitIds, ...reservedIds];
    const hubPlaces = await this.places.findByHub(hub);
    const requested = forcedIds.length
      ? await this.places.findByIds(forcedIds)
      : [];

    // The islands rule, applied before anything is scored. A must-visit is
    // normally sacred, but "Aya Yorgi and then Kadıköy" is not a day that can
    // be walked at any pace, and honouring it would produce a plan that only
    // looks valid. Dropping the stop and saying so is the honest failure.
    const notices: ItineraryNotice[] = [];
    const forced = requested.filter((p) => this.canShareDay(p.hub, hub));
    const excluded = requested.filter((p) => !this.canShareDay(p.hub, hub));
    if (excluded.length > 0) {
      notices.push({
        code: 'adalar-separate-day',
        severity: 'warning',
        places: excluded.map((p) => p.name),
      });
    }

    const pool = this.dedupe([...forced, ...hubPlaces]);
    const mustSet = new Set(forced.map((p) => p.placeId));

    // 2 — score and sort (must-visits always float to the top).
    const scored = pool
      .map((p) => ({ place: p, score: this.score(p, input, mustSet) }))
      .sort((a, b) => b.score - a.score);

    // 3 — greedy selection within the time budget AND the stop cap.
    const timeBudget = input.paceHours * 60;
    const maxStops = HubBudgetStrategy.maxStopsFor(
      input.paceHours,
      input.walkingTolerance,
    );
    let usedMinutes = 0;
    const selected: Place[] = [];
    // Force must-visits in first (never dropped, never counted against the cap).
    for (const { place } of scored) {
      if (mustSet.has(place.placeId)) {
        selected.push(place);
        usedMinutes += place.avgVisitMinutes;
      }
    }
    for (const { place } of scored) {
      if (mustSet.has(place.placeId)) continue;
      if (selected.length >= maxStops) break;
      // `continue`, not `break`: a long stop that misses the budget must not
      // stop us considering the shorter, lower-scoring ones behind it.
      if (usedMinutes + place.avgVisitMinutes > timeBudget) continue;
      selected.push(place);
      usedMinutes += place.avgVisitMinutes;
    }

    // 4 — weather pass: on rain, replace outdoor non-must stops with indoor
    //     alternatives from the same hub (keeps you in the neighborhood).
    const weatherAdjusted =
      input.weather === 'rainy'
        ? this.swapForIndoor(selected, hubPlaces, mustSet)
        : selected;

    // 5 — order geographically; sunset spots pushed to the end in the evening.
    const geographic = this.orderStops(weatherAdjusted, input);

    /**
     * 5b — and then off the locked doors.
     *
     * Everything above orders by distance, score and weather; none of it had
     * ever looked at whether a place is open when the day arrives. It put
     * Kadıköy Barlar Sokağı — which opens at 16:00 — at 12:51, on every day of
     * the week, and Monday-closed museums into Mondays.
     *
     * Applied to GENERATION only. `rebuild` deliberately skips it: that path
     * exists to honour a stop order the traveller dragged into place, and
     * silently removing one of their stops would undo the edit they just made.
     * They get a notice instead — the same "warn, don't block" rule the rest of
     * the editing flow follows.
     */
    const feasible = respectOpeningHours({
      ordered: geographic,
      startMinutes: input.startHour * 60,
      weekday: normalizeWeekday(input.weekday),
      travelMinutes: (from, to) => this.transportLeg(from, to).durationMinutes,
      // Must-visits and booked stops are never removed by this pass. Topkapı is
      // shut on Tuesdays; a traveller who asked for Topkapı is owed that fact,
      // not a Tuesday that quietly does not contain it.
      forcedIds: mustSet,
    });
    const ordered = feasible.ordered;

    // Said out loud rather than left as a silently shorter day: a stop that
    // disappears without explanation reads as the engine losing it.
    const closedAllDay = feasible.dropped
      .filter((d) => d.reason === 'closed-all-day')
      .map((d) => d.place.name);
    if (closedAllDay.length > 0) {
      notices.push({ code: 'closed-that-day', severity: 'info', places: closedAllDay });
    }
    const tooLate = feasible.dropped
      .filter((d) => d.reason === 'never-open-in-time')
      .map((d) => d.place.name);
    if (tooLate.length > 0) {
      notices.push({ code: 'opens-too-late', severity: 'info', places: tooLate });
    }

    // A stop the traveller asked for, that is shut when the day reaches it.
    // Kept in the plan and warned about — this is the one case where the
    // notice is the whole point, because the stop is still on the list.
    if (feasible.keptClosed.length > 0) {
      notices.push({
        code: 'must-visit-closed',
        severity: 'warning',
        places: feasible.keptClosed.map((k) => k.place.name),
      });
    }

    // 6–8 — assemble, measure against the real clock, trim until it fits.
    return this.assembleWithinDay(ordered, input, hub, mustSet, notices, feasible.waits);
  }

  /**
   * Can a place from `placeHub` appear on a day built around `dayHub`?
   *
   * Only one rule, and only because the islands earn it: Adalar is a scheduled
   * ferry away from everything else, roughly ninety minutes each way, so an
   * island stop and a mainland stop cannot both fit a single day no matter how
   * the arithmetic is arranged. Every other pairing is a boat ride or a bus
   * ride the model can now cost honestly, so the engine lets the user have it.
   */
  private canShareDay(placeHub: Hub, dayHub: Hub): boolean {
    return (HUB_SIDE[placeHub] === 'Islands') === (HUB_SIDE[dayHub] === 'Islands');
  }

  /**
   * Assemble the day, then shorten it until it fits the time it was given.
   *
   * Selection (step 3) can only budget visit minutes: travel time depends on
   * the order, and the order is not known yet. Left there, an eight-hour
   * request came back as a nine-hour day. Rather than guess an overhead per
   * stop, the day is measured once it is real and the tail is trimmed — the
   * tail being where the nearest-neighbour tour puts the longest hops.
   *
   * Must-visits and reservations are never trimmed. On an island day the
   * deadline is whichever comes first: the pace the user asked for, or leaving
   * enough of the evening to catch the last boat back.
   */
  private assembleWithinDay(
    ordered: Place[],
    input: RouteGenerationInput,
    hub: Hub,
    mustSet: Set<string>,
    notices: ItineraryNotice[],
    /** placeId → minutes to wait for the door to open, from the feasibility pass. */
    waits: Map<string, number> = new Map(),
  ): Itinerary {
    const dayStart = input.startHour * 60;
    const deadline = Math.min(
      dayStart + input.paceHours * 60,
      HUB_SIDE[hub] === 'Islands'
        ? ISLAND_LAST_FERRY_MIN - ISLAND_RETURN_BUFFER_MIN
        : Infinity,
    );

    // A day is too long if it runs past the clock, or — for a traveller who
    // said they would rather not walk far — if it asks for too many metres on
    // foot. Both are trimmed the same way, from the tail, because the tail is
    // where the nearest-neighbour tour puts the longest hops.
    const walkCeiling =
      input.walkingTolerance === 'short'
        ? HubBudgetStrategy.SHORT_WALK_CEILING_METERS
        : Infinity;

    const stops = [...ordered];
    let itinerary = this.assemble(stops, input, hub, waits);
    const tooLong = () => dayStart + itinerary.totalDurationMinutes > deadline;
    // The walking rule stops at three stops. Below that it is no longer
    // shortening a day, it is deleting one — and someone who cannot walk far
    // still came to Istanbul to see something.
    const tooFar = () =>
      this.walkingMeters(itinerary) > walkCeiling &&
      stops.length > HubBudgetStrategy.MIN_STOPS_AFTER_WALK_TRIM;

    while (tooLong() || tooFar()) {
      const idx = stops.map((p) => mustSet.has(p.placeId)).lastIndexOf(false);
      if (idx === -1) break; // only forced stops left — say so instead
      stops.splice(idx, 1);
      itinerary = this.assemble(stops, input, hub, waits);
    }

    return {
      ...itinerary,
      notices: [
        ...notices,
        ...this.dayNotices(stops, hub, dayStart + itinerary.totalDurationMinutes),
      ],
    };
  }

  /**
   * Metres the traveller actually walks. Ferry and metro legs carry distance
   * too, and counting them would penalise a day for a boat ride the traveller
   * spends sitting down.
   */
  private walkingMeters(itinerary: Itinerary): number {
    return itinerary.stops.reduce(
      (sum, s) =>
        sum +
        (s.transportToNext?.mode === 'walk' ? s.transportToNext.distanceMeters : 0),
      0,
    );
  }

  /** What the traveller should be told about the shape of the finished day. */
  private dayNotices(stops: Place[], hub: Hub, endMinutes: number): ItineraryNotice[] {
    if (HUB_SIDE[hub] === 'Islands') {
      // Trimming keeps ordinary days clear of this, but a day made entirely of
      // must-visits can still run long — and then the warning is the whole
      // point, because nothing else is going to tell them.
      const late = endMinutes > ISLAND_LAST_FERRY_MIN - ISLAND_RETURN_BUFFER_MIN;
      return [
        {
          code: late ? 'adalar-last-ferry' : 'adalar-return-ferry',
          severity: late ? 'warning' : 'info',
        },
      ];
    }
    const sides = new Set(stops.map((p) => HUB_SIDE[p.hub]));
    return sides.size > 1
      ? [{ code: 'cross-side-day', severity: 'info' }]
      : [];
  }

  // ── scoring ──────────────────────────────────────────────────────

  private score(
    place: Place,
    input: RouteGenerationInput,
    mustSet: Set<string>,
  ): number {
    if (mustSet.has(place.placeId)) return Number.MAX_SAFE_INTEGER;

    // Base quality signal. An unrated place scores as if it were average rather
    // than as if it were bad: `null` means nobody has judged it, and treating
    // that as 0 would bury two thirds of the catalogue behind the handful of
    // places that happen to carry a curated score. Interest overlap (+25 each)
    // is a far stronger lever anyway, so this only breaks near-ties.
    let score = (place.rating ?? HubBudgetStrategy.UNRATED_BASELINE) * 10;

    // Interest overlap is the strongest lever.
    const overlap = place.interests.filter((i) =>
      input.interests.includes(i),
    ).length;
    score += overlap * 25;

    // Group fit — friends lean nightlife/markets, couples lean sunset/food,
    // solo travelers get a small bump on safe, walkable culture stops.
    score += this.groupBonus(place, input.group);

    // A family day should not be built around the places people go to drink.
    // Demoted, not excluded: the answer said who is travelling, not that a
    // rooftop bar must never appear, and the catalogue has exactly seven
    // nightlife-tagged places — small enough that hiding them outright would
    // quietly empty part of one or two hubs.
    if (input.group === 'family' && place.interests.includes('nightlife')) {
      score -= HubBudgetStrategy.NIGHTLIFE_PENALTY_FOR_FAMILIES;
    }

    // First visit or not. Both bonuses sit below one interest match (+25), so
    // this settles ties and orders the shortlist without overruling what the
    // traveller actually said they were interested in.
    if (input.visitedBefore === false && place.placeType === 'landmark') {
      score += HubBudgetStrategy.FAMILIARITY_BONUS;
    }
    if (input.visitedBefore === true && place.interests.includes('hiddengem')) {
      score += HubBudgetStrategy.FAMILIARITY_BONUS;
    }

    // Gently penalize expensive tickets when the budget is tight.
    if (place.entryFeeTry > input.budgetTry * 0.25) score -= 15;

    return score;
  }

  /**
   * Exhaustive on purpose, with no `default`.
   *
   * This was three cases and no fallthrough, so adding `family` to `GroupType`
   * would have returned `undefined` here, made the running score `NaN`, and
   * handed the sort a comparator that answers `NaN` to every question — which
   * does not throw, does not warn, and quietly returns the pool in whatever
   * order it happened to be in. The `never` check turns the next value added
   * to the union into a compile error instead of a silently scrambled day.
   */
  private groupBonus(place: Place, group: GroupType): number {
    switch (group) {
      case 'friends':
        return place.interests.includes('food') ||
          place.interests.includes('market')
          ? 12
          : 0;
      case 'couple':
        return place.isSunsetSpot || place.interests.includes('food') ? 12 : 0;
      case 'solo':
        return place.interests.includes('history') ||
          place.interests.includes('art')
          ? 8
          : 0;
      // No positive lever for families yet. Seven places carry the `family`
      // interest, which is too thin to steer a day with, and inventing a
      // proxy — "families like parks" — would be a guess wearing the clothes
      // of data. The nightlife demotion above is what this answer does.
      case 'family':
        return 0;
      default: {
        const exhaustive: never = group;
        return exhaustive;
      }
    }
  }

  // ── weather swap ─────────────────────────────────────────────────

  private swapForIndoor(
    selected: Place[],
    hubPlaces: Place[],
    mustSet: Set<string>,
  ): Place[] {
    const chosenIds = new Set(selected.map((p) => p.placeId));
    const indoorAlternatives = hubPlaces
      .filter((p) => p.isIndoor && !chosenIds.has(p.placeId))
      // Unrated places sort as mid-range, not as zero — see UNRATED_BASELINE.
      .sort(
        (a, b) =>
          (b.rating ?? HubBudgetStrategy.UNRATED_BASELINE) -
          (a.rating ?? HubBudgetStrategy.UNRATED_BASELINE),
      );

    return selected.map((p) => {
      if (p.isIndoor || mustSet.has(p.placeId)) return p;
      const swap = indoorAlternatives.shift();
      return swap ?? p; // keep original if no indoor option remains
    });
  }

  // ── ordering ─────────────────────────────────────────────────────

  private orderStops(places: Place[], input: RouteGenerationInput): Place[] {
    if (places.length <= 1) return places;

    // Seed the nearest-neighbour tour from the start origin if given, otherwise
    // the northern-most stop so the walk reads naturally. (A real build would
    // call OSRM for a true optimized route.)
    const remaining = [...places];
    const startAnchor: LatLng =
      input.startOrigin ?? remaining.reduce((a, b) => (a.lat > b.lat ? a : b));

    // First stop = the place nearest the start anchor.
    let firstIdx = 0;
    let firstDist = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineMeters(startAnchor, p);
      if (d < firstDist) {
        firstDist = d;
        firstIdx = i;
      }
    });
    const tour: Place[] = [remaining[firstIdx]];
    remaining.splice(firstIdx, 1);

    while (remaining.length) {
      const last = tour[tour.length - 1];
      let nearestIdx = 0;
      let nearestDist = Infinity;
      remaining.forEach((p, i) => {
        const d = haversineMeters(last, p);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      });
      tour.push(remaining[nearestIdx]);
      remaining.splice(nearestIdx, 1);
    }

    // Time anchors (mid-stop pinning A2 / reservations): pinned stops keep their
    // fixed times and act as anchors. Free stops flow around them in the
    // geographic (NN) order, timed by their realistic durations so "before" and
    // "after" the anchor sequence sensibly.
    const reservations = input.reservations ?? [];
    if (reservations.length > 0) {
      const pinned = new Map(reservations.map((r) => [r.placeId, this.toMinutes(r.time)]));
      let clock = input.startHour * 60;
      const withAnchor = tour.map((p) => {
        if (pinned.has(p.placeId)) {
          return { p, anchor: pinned.get(p.placeId) as number };
        }
        const anchor = clock;
        clock += p.avgVisitMinutes + 15; // visit + a short travel buffer
        return { p, anchor };
      });
      // Stable sort keeps the NN order among free stops while anchors slot by time.
      withAnchor.sort((a, b) => a.anchor - b.anchor);
      return withAnchor.map((x) => x.p);
    }

    // End anchoring takes priority over the evening rule: if an end origin is
    // set, force the stop nearest it to be last. Otherwise, on an evening start
    // push sunset spots to the tail so golden hour lands right.
    if (input.endOrigin && tour.length > 1) {
      const end = input.endOrigin;
      const endStop = tour.reduce((closest, p) =>
        haversineMeters(p, end) < haversineMeters(closest, end) ? p : closest,
      );
      const rest = tour.filter((p) => p.placeId !== endStop.placeId);
      return [...rest, endStop];
    }

    const isEvening = input.startHour >= 16;
    if (isEvening) {
      const sunset = tour.filter((p) => p.isSunsetSpot);
      const rest = tour.filter((p) => !p.isSunsetSpot);
      return [...rest, ...sunset];
    }
    return tour;
  }

  /**
   * Rebuild an itinerary from an EXPLICIT stop order (drag-and-drop manual
   * edit). Skips scoring/selection/reordering — just re-runs assembly so times,
   * transport legs, distance and the budget are recomputed for the given order.
   */
  async rebuild(orderedPlaceIds: string[], input: RouteGenerationInput): Promise<Itinerary> {
    const found = await this.places.findByIds(orderedPlaceIds);
    const byId = new Map(found.map((p) => [p.placeId, p]));
    const ordered = orderedPlaceIds
      .map((id) => byId.get(id))
      .filter((p): p is Place => p !== undefined);
    const hub = input.hub ?? ordered[0]?.hub ?? 'kadikoy-moda';
    // No trimming here. The order came from the user dragging stops around;
    // silently deleting one would undo the edit they just made. They still get
    // the notices, so a day that has grown unrealistic says so.
    const itinerary = this.assemble(ordered, input, hub);
    return {
      ...itinerary,
      notices: this.dayNotices(
        ordered,
        hub,
        input.startHour * 60 + itinerary.totalDurationMinutes,
      ),
    };
  }

  // ── assembly (times, lunch, transport, costs) ────────────────────

  private assemble(
    ordered: Place[],
    input: RouteGenerationInput,
    hub: Hub,
    waits: Map<string, number> = new Map(),
  ): Itinerary {
    const reservations = new Map(
      (input.reservations ?? []).map((r) => [r.placeId, r]),
    );
    const stops: ItineraryStop[] = [];
    let clock = input.startHour * 60; // minutes since midnight
    let lunchInserted = false;
    let order = 1;

    let tickets = 0;
    let food = 0;
    let transport = 0;
    let distanceMeters = 0;

    for (let i = 0; i < ordered.length; i++) {
      const place = ordered[i];

      // Auto Lunch Break when the day crosses midday and we haven't eaten.
      if (
        !lunchInserted &&
        clock >= HubBudgetStrategy.LUNCH_START &&
        clock <= HubBudgetStrategy.LUNCH_END + 60
      ) {
        const lunchCost = this.lunchCost(input.group);
        food += lunchCost;
        stops.push({
          order: order++,
          place: null,
          isLunchBreak: true,
          arrivalTime: this.fmt(clock),
          departureTime: this.fmt(clock + HubBudgetStrategy.LUNCH_DURATION),
          durationMinutes: HubBudgetStrategy.LUNCH_DURATION,
          entryFeeTry: 0,
          foodCostTry: lunchCost,
          transportToNext: null,
        });
        clock += HubBudgetStrategy.LUNCH_DURATION;
        lunchInserted = true;
      }

      // Pinned reservation → the stop's arrival time is FIXED. If we'd arrive
      // earlier, we wait; the whole day re-times around this anchor.
      const res = reservations.get(place.placeId);
      if (res) {
        const pinned = this.toMinutes(res.time);
        if (pinned >= clock) clock = pinned; // wait for the booking
        else clock = pinned; // honor the pin even if it means an earlier slot
      }

      // A short wait for opening, decided by the feasibility pass. Arriving at
      // 15:40 somewhere that opens at 16:00 is a coffee, not a defect — but the
      // clock has to admit the twenty minutes rather than pretend the door was
      // open, or every time after this one is wrong.
      const wait = waits.get(place.placeId) ?? 0;
      if (wait > 0) clock += wait;

      const arrival = clock;
      const departure = clock + place.avgVisitMinutes;
      tickets += place.entryFeeTry;
      food += place.avgFoodCostTry;

      // Transport to the next real stop.
      let leg: TransportLeg | null = null;
      const next = ordered[i + 1];
      if (next) {
        leg = this.transportLeg(place, next);
        distanceMeters += leg.distanceMeters;
        transport += this.transportCost(leg, input.group);
      }

      stops.push({
        order: order++,
        place,
        isLunchBreak: false,
        arrivalTime: this.fmt(arrival),
        departureTime: this.fmt(departure),
        durationMinutes: place.avgVisitMinutes,
        entryFeeTry: place.entryFeeTry,
        foodCostTry: place.avgFoodCostTry,
        transportToNext: leg,
        reservation: res
          ? { time: res.time, confirmationCode: res.confirmationCode, note: res.note }
          : undefined,
      });

      clock = departure + (leg?.durationMinutes ?? 0);
    }

    const total = tickets + food + transport;
    return {
      hub,
      mode: input.quiz ? 'quiz-vibe' : 'hub-budget',
      group: input.group,
      weather: input.weather,
      stops,
      costBreakdown: {
        ticketsTry: Math.round(tickets),
        foodTry: Math.round(food),
        transportTry: Math.round(transport),
        totalTry: Math.round(total),
      },
      budgetTry: input.budgetTry,
      overBudget: total > input.budgetTry,
      totalDistanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
      totalDurationMinutes: clock - input.startHour * 60,
      // Filled in by the caller: assembly runs repeatedly while the day is
      // being trimmed, and only the surviving stop list can be described.
      notices: [],
      generatedAt: new Date().toISOString(),
    };
  }

  // ── transport model ──────────────────────────────────────────────

  private transportLeg(from: Place, to: Place): TransportLeg {
    return planLeg(this.transitPoint(from), this.transitPoint(to));
  }

  /**
   * A place as the transit model needs it. `neighborhood` doubles as the island
   * name for Adalar records — Büyükada and Heybeliada are a sailing apart, and
   * nothing else in the model can tell them apart. Elsewhere the field is
   * carried but ignored, since the sides already differ.
   */
  private transitPoint(p: Place): TransitPoint {
    return {
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      side: HUB_SIDE[p.hub],
      island: p.neighborhood,
    };
  }

  /**
   * How many people the day is being costed for.
   *
   * A lookup rather than the chain of ternaries this was, because that chain
   * ended in `: 4` — so `family` would have been priced at four heads by
   * falling off the end of a condition written before families existed. Four
   * happens to be a fair guess for a family, but a guess that arrives by
   * accident is indistinguishable from a bug until someone checks the bill.
   */
  private static readonly HEADS_BY_GROUP: Record<GroupType, number> = {
    solo: 1,
    couple: 2,
    family: 4,
    friends: 4,
  };

  private transportCost(leg: TransportLeg, group: GroupType): number {
    // Istanbulkart fare — one fare for anything that is not walking.
    const perHead = leg.mode === 'walk' ? 0 : 27;
    return perHead * HubBudgetStrategy.HEADS_BY_GROUP[group];
  }

  private lunchCost(group: GroupType): number {
    const perHead = 250;
    return perHead * HubBudgetStrategy.HEADS_BY_GROUP[group];
  }

  // ── helpers ──────────────────────────────────────────────────────

  private dedupe(places: Place[]): Place[] {
    const seen = new Set<string>();
    return places.filter((p) =>
      seen.has(p.placeId) ? false : (seen.add(p.placeId), true),
    );
  }

  private fmt(totalMinutes: number): string {
    const m = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  /** "HH:mm" → minutes since midnight. */
  private toMinutes(hhmm: string): number {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
    if (!m) return 0;
    return Number(m[1]) * 60 + Number(m[2]);
  }
}
