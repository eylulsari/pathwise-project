import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from '../../application/users.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** GET /api/users/me — the authenticated user's profile. */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.getPublicProfile(user.id);
  }
}
