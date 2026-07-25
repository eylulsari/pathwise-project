import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertJournalDto {
  @IsString()
  @MaxLength(120)
  placeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}
