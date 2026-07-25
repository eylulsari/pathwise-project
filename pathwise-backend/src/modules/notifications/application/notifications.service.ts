import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationOrmEntity,
  NotificationPreferenceOrmEntity,
  NotificationType,
} from '../infrastructure/persistence/notification.orm-entities';

/**
 * Central Notification Center (B6). Other modules call `notify()` to push a
 * notification (A3 reservations, A6 trial, B3 polls, budget, nearby). Muted
 * types are silently dropped per the user's preferences.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationOrmEntity)
    private readonly notifications: Repository<NotificationOrmEntity>,
    @InjectRepository(NotificationPreferenceOrmEntity)
    private readonly prefs: Repository<NotificationPreferenceOrmEntity>,
  ) {}

  /** Cross-module entry point. Returns null if the type is muted. */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
  ): Promise<NotificationOrmEntity | null> {
    const muted = await this.mutedTypes(userId);
    if (muted.includes(type)) return null;
    return this.notifications.save(
      this.notifications.create({ userId, type, title, body, read: false }),
    );
  }

  async list(userId: string) {
    return this.notifications.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notifications.count({ where: { userId, read: false } });
  }

  /** Whether the user already has a notification of this type (dedupe). */
  async hasType(userId: string, type: NotificationType): Promise<boolean> {
    return (await this.notifications.count({ where: { userId, type } })) > 0;
  }

  async markRead(userId: string, id: string) {
    await this.notifications.update({ id, userId }, { read: true });
  }

  async markAllRead(userId: string) {
    await this.notifications.update({ userId, read: false }, { read: true });
  }

  async getPreferences(userId: string): Promise<string[]> {
    return this.mutedTypes(userId);
  }

  async setPreferences(userId: string, muted: string[]) {
    const existing = await this.prefs.findOne({ where: { userId } });
    if (existing) {
      existing.muted = muted;
      await this.prefs.save(existing);
    } else {
      await this.prefs.save(this.prefs.create({ userId, muted }));
    }
    return { muted };
  }

  private async mutedTypes(userId: string): Promise<string[]> {
    const row = await this.prefs.findOne({ where: { userId } });
    return row?.muted ?? [];
  }
}
