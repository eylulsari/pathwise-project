import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SavedPlacesService } from '../../application/saved-places.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

/**
 * The user id always comes from the auth context, never from the path or the
 * body — a saved-places list that took a userId parameter would let anyone
 * write to anyone's list.
 */
@UseGuards(JwtAuthGuard)
@Controller('saved-places')
export class SavedPlacesController {
  constructor(private readonly saved: SavedPlacesService) {}

  /** GET /api/saved-places — full place records, newest first. */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.saved.list(user.id);
  }

  /** GET /api/saved-places/ids — just the ids, for drawing card toggles. */
  @Get('ids')
  ids(@CurrentUser() user: AuthUser) {
    return this.saved.savedIds(user.id);
  }

  /** PUT, not POST: saving twice is the same as saving once. */
  @Put(':placeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async save(@CurrentUser() user: AuthUser, @Param('placeId') placeId: string) {
    await this.saved.save(user.id, placeId);
  }

  @Delete(':placeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsave(@CurrentUser() user: AuthUser, @Param('placeId') placeId: string) {
    await this.saved.unsave(user.id, placeId);
  }
}
