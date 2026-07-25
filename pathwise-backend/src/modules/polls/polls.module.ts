import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { PollsService } from './application/polls.service';
import { PollsController } from './infrastructure/http/polls.controller';
import {
  PollOrmEntity,
  PollVoteOrmEntity,
} from './infrastructure/persistence/poll.orm-entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([PollOrmEntity, PollVoteOrmEntity]),
    NotificationsModule, // B3 → B6 trigger
  ],
  controllers: [PollsController],
  providers: [PollsService],
})
export class PollsModule {}
