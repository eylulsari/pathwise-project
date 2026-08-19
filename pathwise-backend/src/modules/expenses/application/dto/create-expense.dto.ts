import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const EXPENSE_CATEGORIES = [
  'food',
  'tickets',
  'transport',
  'shopping',
  'other',
] as const;

/** The currencies the converter already supports, plus the base. */
export const EXPENSE_CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'] as const;

export class CreateExpenseDto {
  @IsInt()
  @Min(0)
  @Max(29)
  dayIndex: number;

  @IsIn(EXPENSE_CATEGORIES as readonly string[])
  category: (typeof EXPENSE_CATEGORIES)[number];

  /**
   * Upper bound is deliberate: a trip expense is not ₺100 million, and an
   * unbounded number here would let one fat-fingered entry swamp every total
   * on the page.
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  amount: number;

  @IsIn(EXPENSE_CURRENCIES as readonly string[])
  currency: (typeof EXPENSE_CURRENCIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  placeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  /** Defaults to the caller. Must be the caller or an accepted connection. */
  @IsOptional()
  @IsUUID()
  paidByUserId?: string;

  /** Empty or absent means personal — recorded, but owed by nobody. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  participantIds?: string[];
}
