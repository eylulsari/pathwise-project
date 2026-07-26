import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { AuthUser } from '../../../auth/domain/auth-user';

/**
 * Per-user hourly cap on assistant messages. Runs AFTER JwtAuthGuard (which sets
 * `req.user`), so it keys off the authenticated user id. Kept well under
 * Gemini's own free-tier limits because every user shares one API key.
 */
const CHAT_HOURLY_LIMIT = 25;

@Injectable()
export class ChatRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const userId = req.user?.id;
    if (!userId) return true; // JwtAuthGuard should have set it; fail open.

    // Fixed 1-hour window: the counter's TTL is set on first increment.
    const used = await this.redis.increment(`assistant:rate:${userId}`, 3600);
    if (used > CHAT_HOURLY_LIMIT) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `The assistant is limited to ${CHAT_HOURLY_LIMIT} messages per hour. Please try again a little later.`,
          error: 'TooManyRequests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
