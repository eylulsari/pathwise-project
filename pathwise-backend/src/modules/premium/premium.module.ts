import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PlacesModule } from '../places/places.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PremiumController } from './premium.controller';
import { PremiumGuard } from '../../common/guards/premium.guard';

@Module({
  imports: [UsersModule, PlacesModule, NotificationsModule],
  controllers: [PremiumController],
  providers: [PremiumGuard],
})
export class PremiumModule {}
