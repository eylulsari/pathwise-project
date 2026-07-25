import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './application/analytics.service';
import { AnalyticsController } from './infrastructure/http/analytics.controller';
import { AffiliateClickOrmEntity } from './infrastructure/persistence/affiliate-click.orm-entity';

@Module({
  imports: [TypeOrmModule.forFeature([AffiliateClickOrmEntity])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  // Exported so guards can record paywall hits on a 402.
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
