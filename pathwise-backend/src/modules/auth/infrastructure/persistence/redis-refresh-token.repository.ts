import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { RefreshTokenStorePort } from '../../domain/refresh-token-store.port';

/**
 * Redis adapter for the refresh-token store port. Each valid refresh token is
 * stored under `refresh:<userId>:<jti>` with the token's remaining TTL, which
 * gives us rotation (delete old + write new) and revocation (delete) for free.
 */
@Injectable()
export class RedisRefreshTokenRepository implements RefreshTokenStorePort {
  constructor(private readonly redis: RedisService) {}

  private key(userId: string, jti: string): string {
    return `refresh:${userId}:${jti}`;
  }

  async save(userId: string, jti: string, ttlSeconds: number): Promise<void> {
    await this.redis.setWithTtl(this.key(userId, jti), '1', ttlSeconds);
  }

  async isValid(userId: string, jti: string): Promise<boolean> {
    return this.redis.exists(this.key(userId, jti));
  }

  async revoke(userId: string, jti: string): Promise<void> {
    await this.redis.del(this.key(userId, jti));
  }
}
