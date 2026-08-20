import { IsString, MaxLength, MinLength } from 'class-validator';

export class GenerateAiRouteDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  prompt: string;
}
