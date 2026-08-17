import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * A connection between two real accounts.
 *
 * One row per request, in the direction it was made. Reciprocity is therefore
 * a property of the row's `status`, not of two rows existing: "connected"
 * means exactly one accepted row exists in either direction, which is what
 * makes the rule checkable in a single query and impossible to half-satisfy.
 *
 * The unique constraint is on the ordered pair, so A→B and B→A are different
 * rows. That is deliberate — a crossing pair of requests is a real thing that
 * happens, and the service resolves it by accepting rather than by failing.
 */
@Entity({ name: 'user_connections' })
@Unique(['requesterId', 'addresseeId'])
export class UserConnectionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  requesterId: string;

  @Index()
  @Column({ type: 'uuid' })
  addresseeId: string;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: 'pending' | 'accepted';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date | null;
}

/**
 * One person blocking another.
 *
 * Directional as stored, symmetric as enforced: a single row stops messages
 * both ways and hides the history from both sides. Blocking someone who can
 * still message you is not blocking, and being able to keep reading the thread
 * you just blocked is not either.
 */
@Entity({ name: 'user_blocks' })
@Unique(['blockerId', 'blockedId'])
export class UserBlockOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  blockerId: string;

  @Index()
  @Column({ type: 'uuid' })
  blockedId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/**
 * A message. Text and nothing else.
 *
 * No attachment column, and not as an oversight to be filled in later: a file
 * upload is a different product with a different abuse surface — storage of
 * arbitrary bytes, content scanning, malware, and images that cannot be
 * unseen once delivered. Text can be read, reported and moderated with what
 * this codebase already has.
 */
@Entity({ name: 'direct_messages' })
// The only read pattern is "this conversation, oldest first", and the only
// write-time query is "how many has this person sent recently".
@Index(['senderId', 'recipientId', 'createdAt'])
@Index(['senderId', 'createdAt'])
export class DirectMessageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  senderId: string;

  @Index()
  @Column({ type: 'uuid' })
  recipientId: string;

  @Column({ type: 'varchar', length: 2000 })
  body: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
