import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'content_reports' })
export class ContentReportOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reporterUserId: string;

  @Column({ type: 'varchar', length: 16 })
  contentType: string;

  @Column({ type: 'varchar', length: 120 })
  contentId: string;

  @Column({ type: 'varchar', length: 300 })
  reason: string;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
