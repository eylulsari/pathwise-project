import { ContentReport, ReportedContentType } from './content-report';

export const CONTENT_REPORT_REPOSITORY = Symbol('CONTENT_REPORT_REPOSITORY');

export interface CreateReportData {
  reporterUserId: string;
  contentType: ReportedContentType;
  contentId: string;
  reason: string;
}

/** Repository Pattern port for the moderation queue. */
export interface ContentReportRepositoryPort {
  create(data: CreateReportData): Promise<ContentReport>;
  findOpen(): Promise<ContentReport[]>;
}
