import { IsIn } from 'class-validator';

/**
 * Demo subscription switch. In production this endpoint would NOT accept the
 * tier directly — a payment provider webhook (Stripe/İyzico) would set it after
 * a verified charge. TODO: replace with real payment integration.
 */
export class SubscriptionDto {
  @IsIn(['free', 'premium'])
  tier: 'free' | 'premium';
}
