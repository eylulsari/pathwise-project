import type { Itinerary } from '../types';

/**
 * What the Istanbul Museum Pass would cover on this day.
 *
 * ⚠️ WHAT THIS DELIBERATELY DOES NOT DO: quote the price of the pass, or
 * present a net saving.
 *
 * A net saving is `covered fees − pass price`, and Pathwise has no reliable
 * figure for the second term. The pass is repriced by its operator, and a
 * hardcoded number would be stale within a season and read as a quote the
 * traveller could hold us to — the same reason there is no price on the tours
 * page. So this reports the one side it can defend: what the covered entries
 * are estimated to cost if bought separately. The card then tells the reader
 * to check the current pass price themselves and do the subtraction.
 *
 * ⚠️ AND THE FEES THEMSELVES ARE ESTIMATES. All five pass-covered places in
 * the dataset carry `entryFeeApprox: true` — not one has a verified ticket
 * price. `allApprox` exists so the UI can say "~" and the word "estimated"
 * rather than printing a total that looks researched.
 */
export interface MuseumPassSummary {
  /** Names of the covered stops, in the order the day visits them. */
  coveredNames: string[];
  /** Sum of their estimated entry fees, in lira. */
  estimatedFeesTry: number;
  /** True when every covered fee is flagged approximate — currently always. */
  allApprox: boolean;
  /** How many stops in the day carry an entry fee but are NOT covered. */
  uncoveredPaidStops: number;
}

export function museumPassSummary(itinerary: Itinerary | null): MuseumPassSummary {
  const stops = (itinerary?.stops ?? []).filter((s) => s.place);

  const covered = stops.filter((s) => s.place!.museumPass);
  const estimatedFeesTry = covered.reduce((sum, s) => sum + s.place!.entryFeeTry, 0);

  return {
    coveredNames: covered.map((s) => s.place!.name),
    estimatedFeesTry,
    // `?? true` because a missing flag means the dataset never claimed the fee
    // was verified — absence of a claim is not a verification.
    allApprox: covered.every((s) => s.place!.entryFeeApprox ?? true),
    uncoveredPaidStops: stops.filter(
      (s) => !s.place!.museumPass && s.place!.entryFeeTry > 0,
    ).length,
  };
}
