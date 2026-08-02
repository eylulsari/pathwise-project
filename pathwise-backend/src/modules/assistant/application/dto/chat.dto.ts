import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** One text part of a chat turn (the canonical `parts` shape — see ChatTurn). */
export class ChatPartDto {
  @IsString()
  @MaxLength(4000)
  text: string;
}

/** One history turn. `role` is 'user' or 'model' (translated per provider). */
export class ChatTurnDto {
  @IsIn(['user', 'model'])
  role: 'user' | 'model';

  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ChatPartDto)
  parts: ChatPartDto[];
}

/**
 * POST /assistant/chat body. The global ValidationPipe runs with
 * `forbidNonWhitelisted`, so every accepted field must be declared here.
 */
export class ChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message: string;

  /** Recent turns for context. The client caps this (~6–8); we cap again here. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  conversationHistory?: ChatTurnDto[];

  /** Names of stops on the user's current Today's Path, for personalisation. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  activePlan?: string[];
}
