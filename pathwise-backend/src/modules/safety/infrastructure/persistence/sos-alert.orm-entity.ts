import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** An emergency SOS alert (Phase 2). Real routing to local authorities /
 *  an SMS gateway is a later phase — this records the event. */
@Entity({ name: 'sos_alerts' })
export class SosAlertOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  /** Buddy user ids the location was shared with (empty for now). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  sharedWithUserIds: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
