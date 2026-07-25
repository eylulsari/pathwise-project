import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../modules/users/application/users.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  FREE_OPTIMIZE_LIMIT,
  optimizeDailyKey,
  secondsUntilMidnight,
} from './optimize-limit.constants';

/**
 * Daily route-optimize limit. Optional auth:
 *  - anonymous (no token)  → allowed (public landing/quiz preview)
 *  - premium user          → unlimited
 *  - free user             → FREE_OPTIMIZE_LIMIT/day, else 402 Payment Required
 */
@Injectable()
export class OptimizeLimitGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = await this.userIdFromToken(req);
    if (!userId) return true; // anonymous preview

    const user = await this.users.findById(userId).catch(() => null);
    if (!user || user.isPremium) return true; // premium → unlimited

    const key = optimizeDailyKey(userId);
    const used = await this.redis.increment(key, secondsUntilMidnight());
    if (used > FREE_OPTIMIZE_LIMIT) {
      // A6 — count the paywall hit.
      await this.redis.increment('paywall:optimize', 90 * 86400);
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: `Free plan is limited to ${FREE_OPTIMIZE_LIMIT} optimizations per day`,
          error: 'PaymentRequired',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return true;
  }

  private async userIdFromToken(req: Request): Promise<string | null> {
    const header = req.headers.authorization;
    if (!header) return null;
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) return null;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      return payload.sub;
    } catch {
      return null; // invalid token → treat as anonymous
    }
  }
}
