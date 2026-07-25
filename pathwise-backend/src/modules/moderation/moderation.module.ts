import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationService } from './application/moderation.service';
import { ModerationController } from './infrastructure/http/moderation.controller';
import { ContentReportOrmEntity } from './infrastructure/persistence/content-report.orm-entity';
import { TypeOrmContentReportRepository } from './infrastructure/persistence/typeorm-content-report.repository';
import { CONTENT_REPORT_REPOSITORY } from './domain/content-report.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([ContentReportOrmEntity])],
  controllers: [ModerationController],
  providers: [
    ModerationService,
    { provide: CONTENT_REPORT_REPOSITORY, useClass: TypeOrmContentReportRepository },
  ],
})
export class ModerationModule {}
