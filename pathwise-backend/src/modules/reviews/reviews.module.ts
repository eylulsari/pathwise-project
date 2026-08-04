import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsService } from './application/reviews.service';
import { ReviewsController } from './infrastructure/http/reviews.controller';
import { PlaceReviewOrmEntity } from './infrastructure/persistence/place-review.orm-entity';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [TypeOrmModule.forFeature([PlaceReviewOrmEntity]), PointsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
