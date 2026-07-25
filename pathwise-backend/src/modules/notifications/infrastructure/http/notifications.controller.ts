import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsIn, IsString } from 'class-validator';
import { NotificationsService } from '../../application/notifications.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

class PreferencesDto {
  @IsArray()
  @IsString({ each: true })
  muted: string[];
}

/** Client-triggerable notifications with server-templated text. */
class EmitDto {
  @IsIn(['budget', 'nearby'])
  type: 'budget' | 'nearby';
}

const EMIT_TEMPLATES: Record<string, { title: string; body: string }> = {
  budget: { title: '💸 Over budget', body: "Today's plan exceeds your budget — trim a paid stop or a meal." },
  nearby: { title: '📍 Friend nearby', body: 'A travel buddy just checked in about 500m away.' },
};

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: AuthUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async readAll(@CurrentUser() user: AuthUser) {
    await this.notifications.markAllRead(user.id);
  }

  @Get('preferences')
  async prefs(@CurrentUser() user: AuthUser) {
    return { muted: await this.notifications.getPreferences(user.id) };
  }

  @Put('preferences')
  setPrefs(@CurrentUser() user: AuthUser, @Body() dto: PreferencesDto) {
    return this.notifications.setPreferences(user.id, dto.muted);
  }

  /** POST /api/notifications/emit — client-side triggers (budget, nearby). */
  @Post('emit')
  @HttpCode(HttpStatus.OK)
  emit(@CurrentUser() user: AuthUser, @Body() dto: EmitDto) {
    const tpl = EMIT_TEMPLATES[dto.type];
    return this.notifications.notify(user.id, dto.type, tpl.title, tpl.body);
  }
}
