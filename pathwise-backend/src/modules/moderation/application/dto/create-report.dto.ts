import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  @IsIn(['forum', 'checkin', 'route'])
  contentType: 'forum' | 'checkin' | 'route';

  @IsString()
  @MaxLength(120)
  contentId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason: string;
}
