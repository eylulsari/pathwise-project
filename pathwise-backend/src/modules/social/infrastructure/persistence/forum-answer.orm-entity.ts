import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Answers users write. Questions remain a curated in-memory seed. */
@Entity({ name: 'forum_answers' })
export class ForumAnswerOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Threads are read by question, so this is the lookup key. NOT a foreign
  // key: questions are a static in-memory seed, not a table.
  @Index()
  @Column({ type: 'varchar', length: 64 })
  questionId: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  // Denormalised at write time — a thread should keep saying who answered
  // even after a rename or an account deletion.
  @Column({ type: 'varchar', length: 120 })
  authorName: string;

  @Column({ type: 'varchar', length: 1000 })
  text: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
