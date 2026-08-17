import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsObject } from 'class-validator';

/**
 * The dashboard's working plan.
 *
 * Each entry is one day and is stored as an opaque object rather than a
 * validated shape. That is a deliberate choice, not a shortcut: the day state
 * is the *client's* view model — which panel is open, which stop is pinned,
 * the cached itinerary — and it changes whenever the dashboard changes.
 * Mirroring it in a DTO would mean every UI tweak needs a matching backend
 * release or users silently stop being able to save.
 *
 * What is enforced is the shape the server actually depends on: an array, of
 * objects, bounded by the trip-length maximum so a single row cannot be grown
 * without limit. Nothing here is trusted for authorisation — the userId comes
 * from the auth context, never from this body.
 */
export class SavePlanDto {
  @IsArray()
  @ArrayMaxSize(7)
  @IsObject({ each: true })
  // Without this the global `enableImplicitConversion` has nothing to go on for
  // the array's items — the reflected type of the property is just `Array` —
  // and it stringifies each day into "[object Object]" before validation runs,
  // so every save fails with "each value in days must be an object".
  @Type(() => Object)
  days: Record<string, unknown>[];
}
