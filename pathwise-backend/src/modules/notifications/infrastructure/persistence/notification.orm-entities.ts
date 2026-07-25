import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Notification types — the triggers wired across the app. */
export type NotificationType =
  | 'reservation' // A3
  | 'trial' // A6
  | 'poll' // B3
  | 'nearby' // social check-in
  | 'budget' // budget tracker
  | 'welcome';

@Entity({ name: 'notifications' })
export class NotificationOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 300 })
  body: string;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity({ name: 'notification_preferences' })
export class NotificationPreferenceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  userId: string;

  /** Notification types the user has muted. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  muted: string[];
}
