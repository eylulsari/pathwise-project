import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TripsService } from '../../application/trips.service';
import { SaveTripDto } from '../../application/dto/save-trip.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  /** POST /api/trips — save the current plan for the signed-in user. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async save(@CurrentUser() user: AuthUser, @Body() dto: SaveTripDto) {
    const trip = await this.trips.save(user.id, dto);
    return trip.toJSON();
  }

  /** GET /api/trips — the signed-in user's saved trips (newest first). */
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const trips = await this.trips.list(user.id);
    return trips.map((t) => t.toJSON());
  }

  /** DELETE /api/trips/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.trips.remove(user.id, id);
  }
}
