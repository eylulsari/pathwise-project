import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ModerationService } from '../../application/moderation.service';
import { CreateReportDto } from '../../application/dto/create-report.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

@UseGuards(JwtAuthGuard)
@Controller()
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  /** POST /api/moderation/reports — file a report on social content. */
  @Post('moderation/reports')
  @HttpCode(HttpStatus.CREATED)
  report(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.moderation.report(user.id, dto);
  }

  /**
   * GET /api/admin/reports — the open moderation queue.
   * TODO: restrict to an admin role once roles exist (currently any auth user).
   */
  @Get('admin/reports')
  queue() {
    return this.moderation.queue();
  }
}
