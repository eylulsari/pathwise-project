import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { RefreshTokenStorePort } from '../../domain/refresh-token-store.port';
import { RefreshTokenOrmEntity } from './refresh-token.orm-entity';

/**
 * Postgres adapter for the refresh-token store.
 *
 * Replaces the Redis one. Two things Redis did for free and this has to do
 * explicitly:
 *
 *  1. **Expiry.** Redis dropped keys at their TTL; here `isValid` compares
 *     `expiresAt` itself, so a stale row can never authenticate.
 *  2. **Cleanup.** Nothing evicts rows, so `save` opportunistically deletes
 *     this user's already-expired ones. That keeps the table from growing
 *     without adding a scheduler — the work is O(one user's dead tokens) and
 *     happens on a path that is already writing.
 */
@Injectable()
export class TypeOrmRefreshTokenRepository implements RefreshTokenStorePort {
  constructor(
    @InjectRepository(RefreshTokenOrmEntity)
    private readonly repo: Repository<RefreshTokenOrmEntity>,
  ) {}

  async save(userId: string, jti: string, ttlSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.repo.save(this.repo.create({ userId, jti, expiresAt }));
    // Opportunistic prune of this user's dead rows (see the note above).
    await this.repo.delete({ userId, expiresAt: LessThan(new Date()) });
  }

  async isValid(userId: string, jti: string): Promise<boolean> {
    const row = await this.repo.findOne({ where: { userId, jti } });
    // A row that outlived its token is not valid — Postgres has no TTL.
    return !!row && row.expiresAt.getTime() > Date.now();
  }

  async revoke(userId: string, jti: string): Promise<void> {
    await this.repo.delete({ userId, jti });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
