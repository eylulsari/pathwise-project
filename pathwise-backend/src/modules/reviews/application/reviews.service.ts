import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlaceReviewOrmEntity } from '../infrastructure/persistence/place-review.orm-entity';
import { PointsService } from '../../points/application/points.service';

/**
 * Real user reviews for places (Phase 3). One review per user+place (upsert);
 * exposes the community average alongside the static Google rating.
 */
@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(PlaceReviewOrmEntity)
    private readonly reviews: Repository<PlaceReviewOrmEntity>,
    private readonly points: PointsService,
  ) {}

  async listForPlace(placeId: string) {
    const rows = await this.reviews.find({
      where: { placeId },
      order: { helpfulCount: 'DESC', createdAt: 'DESC' },
    });
    const count = rows.length;
    const average =
      count === 0
        ? 0
        : Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
    return {
      average,
      count,
      reviews: rows.map((r) => ({
        id: r.id,
        authorName: r.authorName,
        rating: r.rating,
        comment: r.comment,
        helpfulCount: r.helpfulCount,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * Leave or update a review. Reward points are granted for the *first* review
   * of a place only — this is an upsert, so editing an existing review must not
   * re-earn (otherwise the same review could be edited repeatedly to farm
   * points). `pointsAwarded` is 0 on the update path.
   */
  async create(
    userId: string,
    authorName: string,
    placeId: string,
    rating: number,
    comment: string,
  ) {
    const existing = await this.reviews.findOne({ where: { userId, placeId } });
    let pointsAwarded = 0;
    if (existing) {
      existing.rating = rating;
      existing.comment = comment;
      await this.reviews.save(existing);
    } else {
      await this.reviews.save(
        this.reviews.create({ userId, authorName, placeId, rating, comment, helpfulCount: 0 }),
      );
      const award = await this.points.award(userId, 'review', placeId);
      pointsAwarded = award.awarded;
    }
    return { ...(await this.listForPlace(placeId)), pointsAwarded };
  }

  async markHelpful(reviewId: string) {
    const row = await this.reviews.findOne({ where: { id: reviewId } });
    if (!row) throw new BadRequestException('Review not found');
    row.helpfulCount += 1;
    await this.reviews.save(row);
    return { id: row.id, helpfulCount: row.helpfulCount };
  }
}
