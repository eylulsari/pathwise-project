import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../../users/application/users.service';
import {
  ReferralCodeOrmEntity,
  ReferralRedemptionOrmEntity,
} from '../infrastructure/persistence/referral.orm-entities';

const REWARD_DAYS = 3;

/**
 * Referral program (B2). Each user has a unique invite code; redeeming a code
 * on sign-up rewards BOTH the referrer and the new user with premium days
 * (reuses UsersService.grantPremiumDays → the trial window shared with A6).
 */
@Injectable()
export class ReferralService {
  constructor(
    @InjectRepository(ReferralCodeOrmEntity)
    private readonly codes: Repository<ReferralCodeOrmEntity>,
    @InjectRepository(ReferralRedemptionOrmEntity)
    private readonly redemptions: Repository<ReferralRedemptionOrmEntity>,
    private readonly users: UsersService,
  ) {}

  private gen(): string {
    return (
      'PW' + Math.random().toString(36).slice(2, 8).toUpperCase()
    );
  }

  /** Get (or lazily create) the caller's code + how many friends joined. */
  async myReferral(userId: string) {
    let row = await this.codes.findOne({ where: { userId } });
    if (!row) {
      let code = this.gen();
      // Avoid the (unlikely) collision.
      while (await this.codes.findOne({ where: { code } })) code = this.gen();
      row = await this.codes.save(this.codes.create({ userId, code }));
    }
    const redeemedCount = await this.redemptions.count({
      where: { referrerUserId: userId },
    });
    return { code: row.code, redeemedCount, rewardDays: REWARD_DAYS };
  }

  /** Redeem a code as a new user → reward both sides. */
  async redeem(newUserId: string, code: string) {
    const already = await this.redemptions.findOne({ where: { newUserId } });
    if (already) throw new BadRequestException('You have already used a referral code');

    const owner = await this.codes.findOne({ where: { code: code.toUpperCase() } });
    if (!owner) throw new NotFoundException('Invalid referral code');
    if (owner.userId === newUserId) throw new BadRequestException('You cannot use your own code');

    await this.redemptions.save(
      this.redemptions.create({
        code: owner.code,
        referrerUserId: owner.userId,
        newUserId,
        rewardDays: REWARD_DAYS,
      }),
    );

    // Reward both — extends the shared premium/trial window.
    const me = await this.users.grantPremiumDays(newUserId, REWARD_DAYS);
    await this.users.grantPremiumDays(owner.userId, REWARD_DAYS);
    return { rewardedDays: REWARD_DAYS, user: me };
  }
}
