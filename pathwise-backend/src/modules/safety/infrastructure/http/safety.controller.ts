import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { SafetyService } from '../../application/safety.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

class SosAlertDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @IsBoolean()
  share?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sharedWithUserIds?: string[];
}

@UseGuards(JwtAuthGuard)
@Controller('safety')
export class SafetyController {
  constructor(private readonly safety: SafetyService) {}

  /** POST /api/safety/sos-alert — record an emergency alert (+ optional share). */
  @Post('sos-alert')
  @HttpCode(HttpStatus.CREATED)
  sos(@CurrentUser() user: AuthUser, @Body() dto: SosAlertDto) {
    return this.safety.raiseAlert(
      user.id,
      user.name,
      dto.lat,
      dto.lng,
      dto.sharedWithUserIds ?? [],
      dto.share ?? false,
    );
  }
}
