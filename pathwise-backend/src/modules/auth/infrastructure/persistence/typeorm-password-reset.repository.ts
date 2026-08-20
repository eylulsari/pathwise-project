import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { PasswordResetStorePort } from '../../domain/password-reset.port';
import { PasswordResetTokenOrmEntity } from './password-reset-token.orm-entity';

/**
 * Postgres adapter for reset tokens.
 *
 * Same two obligations as the refresh-token store next door — expiry is
 * checked on read because Postgres has no TTL, and dead rows are pruned
 * opportunistically on write rather than by a scheduler.
 */
@Injectable()
export class TypeOrmPasswordResetRepository implements PasswordResetStorePort {
  constructor(
    @InjectRepository(PasswordResetTokenOrmEntity)
    private readonly repo: Repository<PasswordResetTokenOrmEntity>,
  ) {}

  async save(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.repo.save(this.repo.create({ userId, tokenHash, expiresAt }));
    await this.repo.delete({ userId, expiresAt: LessThan(new Date()) });
  }

  async findValid(tokenHash: string): Promise<{ userId: string } | null> {
    const row = await this.repo.findOne({ where: { tokenHash } });
    if (!row) return null;
    // Expired is the same as absent to every caller — never "valid but old".
    if (row.expiresAt.getTime() <= Date.now()) return null;
    return { userId: row.userId };
  }

  async consume(tokenHash: string): Promise<void> {
    await this.repo.delete({ tokenHash });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
