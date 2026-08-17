import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { MessagingService } from '../../application/messaging.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  // Text only. There is no attachment field to add one to, and the length cap
  // is what keeps a "message" from becoming a payload.
  @MaxLength(2000)
  body: string;
}

/**
 * Direct messages between connected accounts.
 *
 * Every id in a path is the *other* person; who is acting is always taken from
 * the JWT via `@CurrentUser`, never from the body. That is the difference
 * between a rule and a suggestion: a crafted request cannot claim to be
 * someone else, because it is never asked.
 */
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  // ── connections ──────────────────────────────────────────────────

  @Get('connections')
  connections(@CurrentUser() user: AuthUser) {
    return this.messaging.listConnections(user.id);
  }

  @Post('connections/:userId/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Rate limiting for this feature lives in the service, counted per account
  // from the tables. @Throttle keys on IP, which would make one hotel wifi a
  // single shared budget.
  request(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) otherId: string,
  ) {
    return this.messaging.requestConnection(user.id, otherId);
  }

  @Post('connections/:userId/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  accept(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) otherId: string,
  ) {
    return this.messaging.acceptConnection(user.id, otherId);
  }

  // ── blocking ─────────────────────────────────────────────────────

  @Post('blocks/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  block(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) otherId: string,
  ) {
    return this.messaging.block(user.id, otherId);
  }

  @Delete('blocks/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unblock(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) otherId: string,
  ) {
    return this.messaging.unblock(user.id, otherId);
  }

  // ── messages ─────────────────────────────────────────────────────

  /**
   * The conversation with one person.
   *
   * `since` lets the client poll for what it has not seen instead of refetching
   * the thread. There is no websocket here on purpose — see the module note.
   */
  @Get(':userId')
  thread(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) otherId: string,
    @Query('since') since?: string,
  ) {
    return this.messaging.thread(user.id, otherId).then((rows) =>
      since
        ? rows.filter((r) => r.createdAt.toISOString() > since)
        : rows,
    );
  }

  @Post(':userId')
  send(
    @CurrentUser() user: AuthUser,
    @Param('userId', ParseUUIDPipe) otherId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messaging.send(user.id, otherId, dto.body);
  }
}
