import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './application/notifications.service';
import { NotificationsController } from './infrastructure/http/notifications.controller';
import {
  NotificationOrmEntity,
  NotificationPreferenceOrmEntity,
} from './infrastructure/persistence/notification.orm-entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationOrmEntity, NotificationPreferenceOrmEntity]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  // Exported so A3/A6/B3 (and others) can push notifications.
  exports: [NotificationsService],
})
export class NotificationsModule {}
