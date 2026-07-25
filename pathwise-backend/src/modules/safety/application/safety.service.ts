import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { SosAlertOrmEntity } from '../infrastructure/persistence/sos-alert.orm-entity';

/**
 * SOS / safety (Phase 2). Records an emergency alert and, when the user shares
 * their location, pushes a notification to the Notification Center.
 *
 * TODO: real integration — route to local authorities and an SMS/push gateway,
 * and deliver the alert to each connected buddy's device. For now the alert is
 * persisted and a demo notification is created for the sender.
 */
@Injectable()
export class SafetyService {
  constructor(
    @InjectRepository(SosAlertOrmEntity)
    private readonly alerts: Repository<SosAlertOrmEntity>,
    private readonly notifications: NotificationsService,
  ) {}

  async raiseAlert(
    userId: string,
    userName: string,
    lat: number,
    lng: number,
    sharedWithUserIds: string[],
    share: boolean,
  ) {
    const alert = await this.alerts.save(
      this.alerts.create({ userId, lat, lng, sharedWithUserIds: share ? sharedWithUserIds : [] }),
    );

    if (share) {
      // Demo: notify the sender that the share happened. A real build would
      // push "🆘 <name> shared their emergency location" to each buddy.
      await this.notifications.notify(
        userId,
        'sos',
        '🆘 Emergency location shared',
        `${userName}'s live location was shared with ${sharedWithUserIds.length} travel buddies.`,
      );
    }

    return { id: alert.id, sharedCount: share ? sharedWithUserIds.length : 0, createdAt: alert.createdAt };
  }
}
