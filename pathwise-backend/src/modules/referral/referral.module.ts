import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { PointsModule } from '../points/points.module';
import { ReferralService } from './application/referral.service';
import { ReferralController } from './infrastructure/http/referral.controller';
import {
  ReferralCodeOrmEntity,
  ReferralRedemptionOrmEntity,
} from './infrastructure/persistence/referral.orm-entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReferralCodeOrmEntity, ReferralRedemptionOrmEntity]),
    UsersModule,
    PointsModule,
  ],
  controllers: [ReferralController],
  providers: [ReferralService],
})
export class ReferralModule {}
