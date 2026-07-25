import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ContentReport,
  ReportedContentType,
  ReportStatus,
} from '../../domain/content-report';
import {
  ContentReportRepositoryPort,
  CreateReportData,
} from '../../domain/content-report.repository.port';
import { ContentReportOrmEntity } from './content-report.orm-entity';

@Injectable()
export class TypeOrmContentReportRepository implements ContentReportRepositoryPort {
  constructor(
    @InjectRepository(ContentReportOrmEntity)
    private readonly repo: Repository<ContentReportOrmEntity>,
  ) {}

  private toDomain(row: ContentReportOrmEntity): ContentReport {
    return new ContentReport({
      id: row.id,
      reporterUserId: row.reporterUserId,
      contentType: row.contentType as ReportedContentType,
      contentId: row.contentId,
      reason: row.reason,
      status: row.status as ReportStatus,
      createdAt: row.createdAt,
    });
  }

  async create(data: CreateReportData): Promise<ContentReport> {
    const saved = await this.repo.save(this.repo.create({ ...data, status: 'open' }));
    return this.toDomain(saved);
  }

  async findOpen(): Promise<ContentReport[]> {
    const rows = await this.repo.find({
      where: { status: 'open' },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toDomain(r));
  }
}
