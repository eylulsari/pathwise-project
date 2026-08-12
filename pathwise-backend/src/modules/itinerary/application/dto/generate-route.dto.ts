import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OriginDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsString()
  @MaxLength(120)
  label: string;
}

export class ReservationDto {
  @IsString()
  placeId: string;

  @IsString()
  @MaxLength(5) // "HH:mm"
  time: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  confirmationCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

// Runtime mirror of the `Hub` union in places/domain/place.ts. TypeScript types
// vanish at runtime, so this array is what actually rejects an unknown hub with
// a 400 — forgetting to extend it here makes a new hub silently unroutable.
const HUBS = [
  'sultanahmet',
  'eminonu-sirkeci',
  'beyoglu-taksim',
  'karakoy-galata',
  'besiktas-bogaz',
  'ortakoy-bebek',
  'balat-fener',
  'kadikoy-moda',
  'uskudar',
  'adalar',
] as const;

// Runtime mirror of the `Interest` union. Same reasoning as HUBS above.
const INTERESTS = [
  'food',
  'history',
  'photo',
  'market',
  'art',
  'nature',
  'view',
  'hiddengem',
  'relax',
  'local',
  'culture',
  'nightlife',
  'experience',
  'religion',
] as const;

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
  @Type(() => OriginDto)
  startOrigin?: OriginDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OriginDto)
  endOrigin?: OriginDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReservationDto)
  reservations?: ReservationDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => QuizDto)
  quiz?: QuizDto;
}

/**
 * POST /api/itinerary/rebuild — recompute an itinerary from an explicit stop
 * order (drag-and-drop). No re-optimization: the given order is preserved.
 */
export class RebuildRouteDto {
  @IsArray()
  @IsString({ each: true })
  placeIds: string[];

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

  @IsIn(['sunny', 'rainy'])
  weather: 'sunny' | 'rainy';

  @IsInt()
  @Min(0)
  @Max(23)
  startHour: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => OriginDto)
  startOrigin?: OriginDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OriginDto)
  endOrigin?: OriginDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReservationDto)
  reservations?: ReservationDto[];
}

/** POST /api/itinerary/suggest-nearby — one "add this too" candidate. */
export class SuggestNearbyDto {
  @IsIn(HUBS as unknown as string[])
  hub: (typeof HUBS)[number];

  @IsArray()
  @IsString({ each: true })
  placeIds: string[];
}
