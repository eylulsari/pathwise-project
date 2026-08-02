import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';
import { UsersService } from '../../application/users.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

/**
 * Opt-in women-traveler preferences. Every field is optional — an omitted key
 * leaves that preference untouched, and `identifiesAsWoman: null` clears the
 * declaration back to "not stated". The API never requires a gender.
 *
 * ⚠️ Self-declared, NOT verified: no identity check backs these values.
 */
class SafetyPreferencesDto {
  @IsOptional()
  @IsBoolean()
  identifiesAsWoman?: boolean | null;

  @IsOptional()
  @IsBoolean()
  visibleToWomenOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  showWomenOnly?: boolean;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** GET /api/users/me — the authenticated user's profile. */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.getPublicProfile(user.id);
  }

  /** PATCH /api/users/me/safety-preferences — opt-in women-traveler mode. */
  @UseGuards(JwtAuthGuard)
  @Patch('me/safety-preferences')
  updateSafetyPreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: SafetyPreferencesDto,
  ) {
    return this.usersService.updateSafetyPreferences(user.id, dto);
  }
}
