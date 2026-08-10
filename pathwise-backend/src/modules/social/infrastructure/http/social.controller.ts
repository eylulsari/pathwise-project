import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  mergeTravelStyles,
  QuizAnswers,
  sanitiseTravelStyles,
  SELECTABLE_TRAVEL_STYLES,
  travelStylesFromQuiz,
} from '../../domain/travel-style';
import { SocialService } from '../../application/social.service';
import { MatchingService } from '../../application/matching.service';
import { UsersService } from '../../../users/application/users.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';
import { TravelTag } from '../../domain/traveler';

class TravelStylesDto {
  @IsArray()
  @IsString({ each: true })
  styles: string[];
}

/** Vibe Quiz answers — the same shape the route generator already accepts. */
class QuizStylesDto implements QuizAnswers {
  @IsIn(['history', 'foodie', 'art', 'photo'])
  mood: QuizAnswers['mood'];

  @IsIn(['relaxed', 'moderate', 'packed'])
  pace: QuizAnswers['pace'];

  @IsInt()
  @Min(0)
  @Max(100000)
  budgetTry: number;
}

@UseGuards(JwtAuthGuard)
@Controller('social')
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly matching: MatchingService,
    private readonly users: UsersService,
  ) {}

  /**
   * GET /api/social/travelers?womenOnly=true&tag=%23Foodie
   *
   * Authenticated because the response depends on the caller's own opt-in
   * preferences: what they may see, and whether the women-traveler filter is
   * honoured at all, is decided from their stored profile — not from the query
   * string alone (see the reciprocity rule in SocialService).
   *
   * The result is then ranked by compatibility (Görev 2). Filtering and
   * ranking stay separate on purpose: the filters decide *who* is in the list,
   * matching only decides the order and adds a percentage. Ranking can never
   * reveal someone a filter excluded.
   */
  @Get('travelers')
  async travelers(
    @CurrentUser() authUser: AuthUser,
    @Query('womenOnly') womenOnly?: string,
    @Query('tag') tag?: TravelTag,
  ) {
    const me = await this.users.findById(authUser.id);
    const filtered = this.social.listTravelers(
      { womenOnly: womenOnly === 'true', tag },
      { womenModeActive: me.womenModeActive },
    );
    const viewer = await this.matching.buildViewerProfile(authUser.id);
    return {
      ...filtered,
      travelers: this.matching.rank(filtered.travelers, viewer),
      /**
       * The caller's own profile, so the UI can explain a thin ranking
       * ("add your travel styles to improve these matches") instead of
       * silently showing weak percentages.
       */
      viewerProfile: {
        styles: viewer.styles,
        preferredHubs: viewer.preferredHubs,
        budgetLevel: viewer.budgetLevel,
      },
    };
  }

  /**
   * GET /api/social/travel-styles — the pickable vocabulary.
   *
   * Served rather than hardcoded in the client so the two can never drift:
   * a tag the server would reject can never appear in the picker.
   */
  @Get('travel-styles')
  travelStyles() {
    return { styles: SELECTABLE_TRAVEL_STYLES };
  }

  /**
   * PUT /api/social/me/travel-styles — the manual picker in the profile.
   * Replaces the list outright; this is the only path that can REMOVE a tag.
   */
  @Put('me/travel-styles')
  async setTravelStyles(
    @CurrentUser() authUser: AuthUser,
    @Body() dto: TravelStylesDto,
  ) {
    const styles = sanitiseTravelStyles(dto.styles);
    const user = await this.users.setTravelStyles(authUser.id, styles);
    return { styles: user.travelStyles };
  }

  /**
   * POST /api/social/me/travel-styles/from-quiz — auto-fill from a completed
   * Vibe Quiz. Unions with what is already there rather than replacing it, so
   * rebuilding a route never wipes hand-picked tags (see `mergeTravelStyles`).
   */
  @Post('me/travel-styles/from-quiz')
  async setTravelStylesFromQuiz(
    @CurrentUser() authUser: AuthUser,
    @Body() dto: QuizStylesDto,
  ) {
    const me = await this.users.findById(authUser.id);
    const merged = mergeTravelStyles(me.travelStyles, travelStylesFromQuiz(dto));
    const user = await this.users.setTravelStyles(authUser.id, merged);
    return { styles: user.travelStyles };
  }
}
