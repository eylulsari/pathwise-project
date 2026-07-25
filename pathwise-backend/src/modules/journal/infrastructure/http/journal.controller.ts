import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JournalService } from '../../application/journal.service';
import { UpsertJournalDto } from '../../application/dto/upsert-journal.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

@UseGuards(JwtAuthGuard)
@Controller('journal')
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  /** POST /api/journal — add/update a journal entry for a place. */
  @Post()
  @HttpCode(HttpStatus.OK)
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertJournalDto) {
    return this.journal.upsert(user.id, dto);
  }

  /** GET /api/journal — the user's journal entries. */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.journal.list(user.id);
  }

  /** GET /api/journal/summary — counts + per-category avg ratings. */
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.journal.summary(user.id);
  }
}
