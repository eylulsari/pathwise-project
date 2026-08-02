import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SocialService } from '../../application/social.service';
import { UsersService } from '../../../users/application/users.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';
import { TravelTag } from '../../domain/traveler';

@UseGuards(JwtAuthGuard)
@Controller('social')
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly users: UsersService,
  ) {}

  /**
   * GET /api/social/travelers?womenOnly=true&tag=%23Foodie
   *
   * Authenticated because the response depends on the caller's own opt-in
   * preferences: what they may see, and whether the women-traveler filter is
   * honoured at all, is decided from their stored profile — not from the query
   * string alone (see the reciprocity rule in SocialService).
   */
  @Get('travelers')
  async travelers(
    @CurrentUser() authUser: AuthUser,
    @Query('womenOnly') womenOnly?: string,
    @Query('tag') tag?: TravelTag,
  ) {
    const me = await this.users.findById(authUser.id);
    return this.social.listTravelers(
      { womenOnly: womenOnly === 'true', tag },
      { womenModeActive: me.womenModeActive },
    );
  }
}
