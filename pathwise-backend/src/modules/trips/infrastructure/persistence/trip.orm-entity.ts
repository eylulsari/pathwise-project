import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'trips' })
export class TripOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 40 })
  hub: string;

  @Column({ type: 'real', default: 0 })
  totalDistanceKm: number;

  @Column({ type: 'int', default: 0 })
  totalCostTry: number;

  @Column({ type: 'int', default: 0 })
  stopCount: number;

  @Column({ type: 'jsonb' })
  itinerary: unknown;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
