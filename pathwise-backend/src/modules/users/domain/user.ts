/**
 * Domain model — framework-free. Knows nothing about TypeORM or NestJS.
 * The persistence layer maps this to/from the ORM entity.
 */
export type SubscriptionTier = 'free' | 'premium';

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
    this.createdAt = props.createdAt;
  }

  get isPremium(): boolean {
    return this.subscriptionTier === 'premium';
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
      createdAt: this.createdAt,
    };
  }
}
