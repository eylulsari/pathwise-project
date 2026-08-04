import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { PointsService } from './application/points.service';
import { PointsController } from './infrastructure/http/points.controller';
import { PointTransactionOrmEntity } from './infrastructure/persistence/point-transaction.orm-entity';
import { TypeOrmPointTransactionRepository } from './infrastructure/persistence/typeorm-point-transaction.repository';
import { POINT_TRANSACTION_REPOSITORY } from './domain/point-transaction.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([PointTransactionOrmEntity]), UsersModule],
  controllers: [PointsController],
  providers: [
    PointsService,
    { provide: POINT_TRANSACTION_REPOSITORY, useClass: TypeOrmPointTransactionRepository },
  ],
  // Exported so the modules that own an earning action (analytics/affiliate,
  // referral, reviews) can award points from their own flow.
  exports: [PointsService],
})
export class PointsModule {}
