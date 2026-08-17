import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingService } from './application/messaging.service';
import { MessagingController } from './infrastructure/http/messaging.controller';
import {
  DirectMessageOrmEntity,
  UserBlockOrmEntity,
  UserConnectionOrmEntity,
} from './infrastructure/persistence/messaging.orm-entities';
import { UsersModule } from '../users/users.module';

/**
 * Direct messaging.
 *
 * Delivery is polling, not a socket, and that is a deliberate choice for this
 * deployment rather than a shortcut. The API is stateless and REST; the
 * service sleeps when idle, so a long-lived connection would be dropped and
 * rebuilt on every wake; there is no pub/sub to fan a socket out across a
 * second instance (the only cache here is an in-process Map); and putting the
 * JWT through a socket handshake adds an auth surface to the feature that can
 * least afford one. The client asks for `?since=<iso>` and gets what it has
 * not seen.
 *
 * Moving to SSE later is a change to one endpoint. Moving off a socket, once
 * clients depend on it, is not.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserConnectionOrmEntity,
      UserBlockOrmEntity,
      DirectMessageOrmEntity,
    ]),
    UsersModule,
  ],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
