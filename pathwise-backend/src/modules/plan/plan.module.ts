import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanService } from './application/plan.service';
import { PlanController } from './infrastructure/http/plan.controller';
import { PlanOrmEntity } from './infrastructure/persistence/plan.orm-entity';
import { TypeOrmPlanRepository } from './infrastructure/persistence/typeorm-plan.repository';
import { PLAN_REPOSITORY } from './domain/plan.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([PlanOrmEntity])],
  controllers: [PlanController],
  providers: [
    PlanService,
    { provide: PLAN_REPOSITORY, useClass: TypeOrmPlanRepository },
  ],
  exports: [PlanService],
})
export class PlanModule {}
