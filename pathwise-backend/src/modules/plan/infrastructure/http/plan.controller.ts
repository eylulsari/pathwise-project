import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PlanService } from '../../application/plan.service';
import { SavePlanDto } from '../../application/dto/save-plan.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

/**
 * The working plan. `userId` always comes from the auth context — a plan
 * endpoint that accepted a user id in the path or body would let anyone
 * overwrite anyone's trip.
 */
@UseGuards(JwtAuthGuard)
@Controller('plan')
export class PlanController {
  constructor(private readonly plan: PlanService) {}

  /** GET /api/plan — `{ days: [...] }`, or `{ days: null }` if never edited. */
  @Get()
  async find(@CurrentUser() user: AuthUser) {
    return { days: await this.plan.find(user.id) };
  }

  /** PUT, not POST: the plan is one resource that gets replaced, not a feed. */
  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  async save(@CurrentUser() user: AuthUser, @Body() dto: SavePlanDto) {
    await this.plan.save(user.id, dto.days);
  }

  /** DELETE /api/plan — start over from a freshly generated plan. */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clear(@CurrentUser() user: AuthUser) {
    await this.plan.clear(user.id);
  }
}
