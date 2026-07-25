import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PollsService } from '../../application/polls.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

class PollOptionDto {
  @IsString()
  @MaxLength(120)
  placeId: string;

  @IsString()
  @MaxLength(120)
  label: string;
}

class CreatePollDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  question: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PollOptionDto)
  options: PollOptionDto[];
}

class VoteDto {
  @IsString()
  optionId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('polls')
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePollDto) {
    return this.polls.create(user.id, dto);
  }

  @Get()
  list() {
    return this.polls.listActive();
  }

  @Post(':id/vote')
  @HttpCode(HttpStatus.OK)
  vote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: VoteDto) {
    return this.polls.vote(user.id, id, dto.optionId);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.polls.close(user.id, id);
  }
}
