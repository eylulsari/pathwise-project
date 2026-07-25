import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ReviewsService } from '../../application/reviews.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  comment: string;
}

@Controller('places')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** GET /api/places/:placeId/reviews — reviews + community average. */
  @Get(':placeId/reviews')
  list(@Param('placeId') placeId: string) {
    return this.reviews.listForPlace(placeId);
  }

  /** POST /api/places/:placeId/reviews — leave/update a review. */
  @UseGuards(JwtAuthGuard)
  @Post(':placeId/reviews')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Param('placeId') placeId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(user.id, user.name, placeId, dto.rating, dto.comment);
  }

  /** POST /api/places/:placeId/reviews/:reviewId/helpful — upvote. */
  @UseGuards(JwtAuthGuard)
  @Post(':placeId/reviews/:reviewId/helpful')
  @HttpCode(HttpStatus.OK)
  helpful(@Param('reviewId') reviewId: string) {
    return this.reviews.markHelpful(reviewId);
  }
}
