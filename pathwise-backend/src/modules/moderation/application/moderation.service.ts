import { Inject, Injectable } from '@nestjs/common';
import {
  CONTENT_REPORT_REPOSITORY,
  ContentReportRepositoryPort,
} from '../domain/content-report.repository.port';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ModerationService {
  constructor(
    @Inject(CONTENT_REPORT_REPOSITORY)
    private readonly reports: ContentReportRepositoryPort,
  ) {}

  async report(reporterUserId: string, dto: CreateReportDto) {
    const report = await this.reports.create({ reporterUserId, ...dto });
    return report.toJSON();
  }

  /** The open moderation queue (admin). */
  async queue() {
    const reports = await this.reports.findOpen();
    return reports.map((r) => r.toJSON());
  }
}
