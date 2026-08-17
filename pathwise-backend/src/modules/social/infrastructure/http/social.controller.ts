import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CheckInsService } from '../../application/check-ins.service';
import { ForumService } from '../../application/forum.service';
import { CommunityRoutesService } from '../../application/community-routes.service';
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

/**
 * A check-in as posted.
 *
 * Message only — deliberately. The author is taken from the JWT, never from
 * the body: accepting a userId here would let any caller post as anyone else.
 */
class CreateCheckInDto {
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  message: string;
}

/** A forum answer. Author from the JWT; the body carries only the text. */
class CreateForumAnswerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text: string;
}

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
    private readonly checkIns: CheckInsService,
    private readonly forum: ForumService,
    private readonly routes: CommunityRoutesService,
    private readonly users: UsersService,
  ) {}

  /**
   * GET /api/social/check-ins — the feed: curated demo entries plus every
   * persisted user check-in, newest first.
   */
  @Get('check-ins')
  listCheckIns() {
    return this.checkIns.list();
  }

  /**
   * POST /api/social/check-ins — post a check-in as the signed-in user.
   *
   * The author comes from `@CurrentUser()` (the verified JWT), matching how
   * every other authored endpoint in this codebase works. The body carries the
   * message and nothing else.
   */
  @Post('check-ins')
  @HttpCode(HttpStatus.CREATED)
  createCheckIn(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckInDto) {
    return this.checkIns.create(user.id, user.name, dto.message.trim());
  }

  // ── Q&A forum ───────────────────────────────────────────────────
  /** GET /api/social/forum — seed threads with every persisted answer merged. */
  @Get('forum')
  listForum() {
    return this.forum.list();
  }

  /**
   * POST /api/social/forum/:questionId/answers — answer a thread.
   * Returns the whole updated thread, so the client re-renders from the server
   * rather than guessing where its answer belongs in the order.
   */
  @Post('forum/:questionId/answers')
  @HttpCode(HttpStatus.CREATED)
  answerForum(
    @CurrentUser() user: AuthUser,
    @Param('questionId') questionId: string,
    @Body() dto: CreateForumAnswerDto,
  ) {
    return this.forum.answer(questionId, user.id, user.name, dto.text.trim());
  }

  // ── Community routes ────────────────────────────────────────────
  /** GET /api/social/community-routes — likes and `liked` are per viewer. */
  @Get('community-routes')
  listCommunityRoutes(@CurrentUser() user: AuthUser) {
    return this.routes.list(user.id);
  }

  /**
   * PUT /api/social/community-routes/:id/like — like it.
   *
   * PUT, not a toggling POST: liking is idempotent, so a retry or a double
   * click cannot inflate the count or silently undo the like. The client sends
   * DELETE to take it back, which makes the intent explicit on the wire.
   */
  @Put('community-routes/:id/like')
  likeRoute(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.routes.like(user.id, id);
  }

  /** DELETE /api/social/community-routes/:id/like — take the like back. */
  @Delete('community-routes/:id/like')
  unlikeRoute(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.routes.unlike(user.id, id);
  }

  /**
   * GET /api/social/travelers?womenOnly=true&tag=%23Foodie
   *
   * Authenticated because the response depends on the caller's own opt-in
   * preferences: what they may see, and whether the women-traveler filter is
   * honoured at all, is decided from their stored profile — not from the query
   * string alone (see the reciprocity rule in SocialService).
   *
   * Two lists come back, and only the first one is people. `travelers` are
   * real accounts and are ranked by compatibility; `sampleTravelers` are the
   * demo seed and are returned unranked, because a percentage describing how
   * well you would get along with a fixture is a number about nothing.
   *
   * Filtering and ranking stay separate: the filters decide *who* is in the
   * list, matching only decides the order. Ranking can never reveal someone a
   * filter excluded.
   */
  @Get('travelers')
  async travelers(
    @CurrentUser() authUser: AuthUser,
    @Query('womenOnly') womenOnly?: string,
    @Query('tag') tag?: TravelTag,
  ) {
    const me = await this.users.findById(authUser.id);
    const filtered = await this.social.listTravelers(
      { womenOnly: womenOnly === 'true', tag },
      { womenModeActive: me.womenModeActive },
      authUser.id,
    );

    // Candidates' hubs and budget bands are derived the same way the viewer's
    // are — from saved trips — so both sides of every comparison come from
    // where people actually went rather than from what they said.
    const profiles = await this.matching.buildProfilesFor(
      filtered.travelers.map((t) => ({ id: t.id, travelStyles: t.tags })),
    );
    const withProfiles = filtered.travelers.map((t) => {
      const p = profiles.get(t.id);
      return { ...t, preferredHubs: p?.preferredHubs ?? [], budgetLevel: p?.budgetLevel ?? null };
    });

    const viewer = await this.matching.buildViewerProfile(authUser.id);
    return {
      travelers: this.matching.rank(withProfiles, viewer),
      sampleTravelers: filtered.sampleTravelers,
      womenOnlyApplied: filtered.womenOnlyApplied,
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
