import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { ReferralService } from '../../application/referral.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

class RedeemDto {
  @IsString()
  @Length(4, 16)
  code: string;
}

@UseGuards(JwtAuthGuard)
@Controller('referral')
export class ReferralController {
  constructor(private readonly referral: ReferralService) {}

  /** GET /api/referral/me — my invite code + stats. */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.referral.myReferral(user.id);
  }

  /** POST /api/referral/redeem — redeem a friend's code (rewards both). */
  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  redeem(@CurrentUser() user: AuthUser, @Body() dto: RedeemDto) {
    return this.referral.redeem(user.id, dto.code);
  }
}
