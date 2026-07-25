export type ReportedContentType = 'forum' | 'checkin' | 'route' | 'stale_info';
export type ReportStatus = 'open' | 'reviewed';

/** A user-filed report about a piece of social content. Framework-free. */
export interface ContentReportProps {
  id: string;
  reporterUserId: string;
  contentType: ReportedContentType;
  contentId: string;
  reason: string;
  status: ReportStatus;
  createdAt: Date;
}

export class ContentReport {
  readonly id: string;
  readonly reporterUserId: string;
  readonly contentType: ReportedContentType;
  readonly contentId: string;
  readonly reason: string;
  status: ReportStatus;
  readonly createdAt: Date;

  constructor(p: ContentReportProps) {
    this.id = p.id;
    this.reporterUserId = p.reporterUserId;
    this.contentType = p.contentType;
    this.contentId = p.contentId;
    this.reason = p.reason;
    this.status = p.status;
    this.createdAt = p.createdAt;
  }

  toJSON() {
    return {
      id: this.id,
      contentType: this.contentType,
      contentId: this.contentId,
      reason: this.reason,
      status: this.status,
      createdAt: this.createdAt,
    };
  }
}
