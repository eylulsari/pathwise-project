/**
 * Domain model — framework-free. Knows nothing about TypeORM or NestJS.
 * The persistence layer maps this to/from the ORM entity.
 */
export type SubscriptionTier = 'free' | 'premium' | 'trial';

/**
 * Opt-in women-traveler safety preferences (Phase 2 — competitor gap, cf.
 * women-only matching apps). Three independent, fully optional preferences:
 * one describes how the user identifies, the other two are separate
 * visibility/discovery switches so a user can opt into either direction alone.
 *
 * ⚠️ LEGAL / ETHICAL NOTE — READ BEFORE EXTENDING THIS FEATURE:
 * This is a **self-declaration** system. No identity verification of any kind
 * is performed: Pathwise does not check documents, photos, or any third-party
 * signal, and it cannot know whether a declaration is truthful. These flags
 * must therefore never be surfaced to users as a safety *guarantee*, and every
 * UI surface that exposes them is required to carry the "self-declared, not
 * verified" disclaimer. Nobody is ever required to state a gender: the default
 * for `identifiesAsWoman` is `null` ("not stated"), which is distinct from
 * `false`, and both switches default to off.
 *
 * TODO(verification): if a real verification mechanism is ever added (e.g. an
 * ID/document check or a trusted third-party attestation), model it as a
 * SEPARATE field (e.g. `womanVerifiedAt: Date | null`) — do NOT retrofit
 * `identifiesAsWoman` into a "verified" flag, since existing rows were
 * collected under a self-declaration promise. Re-label the disclaimer strings
 * at the same time, and treat the verification evidence as sensitive personal
 * data (retention limits + a deletion path) rather than a plain column.
 */
export interface SafetyPreferences {
  /** `null` = not stated (the default). Never inferred, only user-set. */
  identifiesAsWoman: boolean | null;
  /** Hide me from travelers who have not made the same declaration. */
  visibleToWomenOnly: boolean;
  /** Show me only travelers who have made the same declaration. */
  showWomenOnly: boolean;
}

export interface UserProps {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  nationality?: string | null;
  age?: number | null;
  travelStyles: string[];
  bio?: string | null;
  subscriptionTier?: SubscriptionTier;
  /** Effective-premium-until timestamp (referral reward B2 + trial A6). */
  trialEndsAt?: Date | null;
  /** Opt-in women-traveler mode — self-declared, never verified. */
  identifiesAsWoman?: boolean | null;
  visibleToWomenOnly?: boolean;
  showWomenOnly?: boolean;
  /** Reward-points balance (Phase 3). Explained by `point_transactions`. */
  points?: number;
  createdAt: Date;
}

export class User {
  readonly id: string;
  name: string;
  readonly email: string;
  passwordHash: string;
  nationality: string | null;
  age: number | null;
  travelStyles: string[];
  bio: string | null;
  subscriptionTier: SubscriptionTier;
  trialEndsAt: Date | null;
  identifiesAsWoman: boolean | null;
  visibleToWomenOnly: boolean;
  showWomenOnly: boolean;
  /**
   * Reward-points balance. Denormalised for cheap reads; the authoritative
   * history is the `point_transactions` ledger owned by the points module —
   * never write this field from anywhere but `PointsService`.
   */
  points: number;
  readonly createdAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.nationality = props.nationality ?? null;
    this.age = props.age ?? null;
    this.travelStyles = props.travelStyles ?? [];
    this.bio = props.bio ?? null;
    this.subscriptionTier = props.subscriptionTier ?? 'free';
    this.trialEndsAt = props.trialEndsAt ?? null;
    this.identifiesAsWoman = props.identifiesAsWoman ?? null;
    this.visibleToWomenOnly = props.visibleToWomenOnly ?? false;
    this.showWomenOnly = props.showWomenOnly ?? false;
    this.points = props.points ?? 0;
    this.createdAt = props.createdAt;
  }

  /** Premium if on the paid tier OR within an active trial/reward window. */
  get isPremium(): boolean {
    if (this.subscriptionTier === 'premium') return true;
    return this.trialEndsAt != null && this.trialEndsAt.getTime() > Date.now();
  }

  /**
   * Reciprocity rule for the women-traveler mode: you only get to see other
   * people's (self-declared) status once you have declared it yourself AND
   * switched at least one side of the mode on. A user who merely browses can
   * never read the flag off anyone else's card.
   */
  get womenModeActive(): boolean {
    return (
      this.identifiesAsWoman === true &&
      (this.visibleToWomenOnly || this.showWomenOnly)
    );
  }

  /** Public-safe view — never leaks the password hash. */
  toPublic() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      nationality: this.nationality,
      age: this.age,
      travelStyles: this.travelStyles,
      bio: this.bio,
      subscriptionTier: this.subscriptionTier,
      trialEndsAt: this.trialEndsAt,
      isPremium: this.isPremium,
      // Own preferences only — this view is `GET /users/me`. These values are
      // never included in any *other* user's public payload; the traveler list
      // decides per-viewer what it may reveal (see SocialService).
      identifiesAsWoman: this.identifiesAsWoman,
      visibleToWomenOnly: this.visibleToWomenOnly,
      showWomenOnly: this.showWomenOnly,
      points: this.points,
      createdAt: this.createdAt,
    };
  }
}
