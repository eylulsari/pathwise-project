import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { SafetyService } from './application/safety.service';
import { SafetyController } from './infrastructure/http/safety.controller';
import { SosAlertOrmEntity } from './infrastructure/persistence/sos-alert.orm-entity';

@Module({
  imports: [TypeOrmModule.forFeature([SosAlertOrmEntity]), NotificationsModule],
  controllers: [SafetyController],
  providers: [SafetyService],
})
export class SafetyModule {}
