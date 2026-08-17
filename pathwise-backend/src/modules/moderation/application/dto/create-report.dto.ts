import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  // 'stale_info' → outdated place info reported from the review UI (Phase 3).
  // Kept in step with ReportedContentType by hand: the type is compile-time,
  // this list is what actually rejects an unknown value at runtime.
  @IsIn(['forum', 'checkin', 'route', 'stale_info', 'message'])
  contentType: 'forum' | 'checkin' | 'route' | 'stale_info' | 'message';

  @IsString()
  @MaxLength(120)
  contentId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason: string;
}
