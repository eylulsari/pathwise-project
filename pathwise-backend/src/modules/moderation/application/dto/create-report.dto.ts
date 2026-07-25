import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  // 'stale_info' → outdated place info reported from the review UI (Phase 3).
  @IsIn(['forum', 'checkin', 'route', 'stale_info'])
  contentType: 'forum' | 'checkin' | 'route' | 'stale_info';

  @IsString()
  @MaxLength(120)
  contentId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason: string;
}
