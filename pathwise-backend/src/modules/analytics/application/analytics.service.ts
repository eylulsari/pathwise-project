import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryStoreService } from '../../../infrastructure/cache/memory-store.service';
import { AffiliateClickOrmEntity } from '../infrastructure/persistence/affiliate-click.orm-entity';

/** Premium-only features whose paywall hits we count (A6). */
export const PAYWALL_FEATURES = ['audio', 'optimize', 'day', 'story', 'pdf'] as const;
export type PaywallFeature = (typeof PAYWALL_FEATURES)[number];

const TTL_90_DAYS = 90 * 86400;

/**
 * Usage analytics (A6). Counts how often each premium-only feature blocked a
 * user (paywall hit) so we can see which drives the most upgrade intent.
 * Backed by in-process counters (reset on restart — analytics, not billing).
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly store: MemoryStoreService,
    @InjectRepository(AffiliateClickOrmEntity)
    private readonly clicks: Repository<AffiliateClickOrmEntity>,
  ) {}

  async recordPaywall(feature: string): Promise<void> {
    await this.store.increment(`paywall:${feature}`, TTL_90_DAYS);
  }

  async paywallStats(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const f of PAYWALL_FEATURES) {
      out[f] = await this.store.getCount(`paywall:${f}`);
    }
    return out;
  }

  // ── Affiliate click tracking (A7) ──
  async recordAffiliateClick(userId: string, tourId: string, source: string): Promise<void> {
    await this.clicks.save(this.clicks.create({ userId, tourId, source }));
  }

  async affiliateStats(): Promise<{ total: number; byTour: Record<string, number> }> {
    const rows = await this.clicks
      .createQueryBuilder('c')
      .select('c.tourId', 'tourId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.tourId')
      .getRawMany<{ tourId: string; count: string }>();
    const byTour: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byTour[r.tourId] = Number(r.count);
      total += Number(r.count);
    }
    return { total, byTour };
  }
}
