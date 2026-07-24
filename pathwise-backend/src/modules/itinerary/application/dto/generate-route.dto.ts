import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const HUBS = [
  'sultanahmet',
  'karakoy-galata',
  'kadikoy-moda',
  'balat-fener',
  'besiktas-bogaz',
] as const;

const INTERESTS = ['food', 'history', 'photo', 'market', 'art', 'nature'] as const;

export class QuizDto {
  @IsIn(['history', 'foodie', 'art', 'photo'])
  mood: 'history' | 'foodie' | 'art' | 'photo';

  @IsIn(['relaxed', 'moderate', 'packed'])
  pace: 'relaxed' | 'moderate' | 'packed';

  @IsNumber()
  @Min(0)
  @Max(50000)
  budgetTry: number;
}

/**
 * POST /api/itinerary/generate body. `mode` selects the strategy via the
 * factory; quiz-vibe mode carries a nested `quiz` object.
 */
export class GenerateRouteDto {
  @IsIn(['hub-budget', 'quiz-vibe'])
  mode: 'hub-budget' | 'quiz-vibe';

  @IsOptional()
  @IsIn(HUBS as unknown as string[])
  hub?: (typeof HUBS)[number];

  @IsNumber()
  @Min(0)
  @Max(50000)
  budgetTry: number;

  @IsNumber()
  @Min(1)
  @Max(12)
  paceHours: number;

  @IsIn(['solo', 'couple', 'friends'])
  group: 'solo' | 'couple' | 'friends';

  @IsOptional()
  @IsArray()
  @IsIn(INTERESTS as unknown as string[], { each: true })
  interests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mustVisitIds?: string[];

  @IsIn(['sunny', 'rainy'])
  weather: 'sunny' | 'rainy';

  @IsInt()
  @Min(0)
  @Max(23)
  startHour: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuizDto)
  quiz?: QuizDto;
}
