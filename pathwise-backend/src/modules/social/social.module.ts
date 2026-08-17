import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialService } from './application/social.service';
import { MatchingService } from './application/matching.service';
import { CheckInsService } from './application/check-ins.service';
import { ForumService } from './application/forum.service';
import { CommunityRoutesService } from './application/community-routes.service';
import { SocialController } from './infrastructure/http/social.controller';
import { CheckInOrmEntity } from './infrastructure/persistence/check-in.orm-entity';
import { ForumAnswerOrmEntity } from './infrastructure/persistence/forum-answer.orm-entity';
import { RouteLikeOrmEntity } from './infrastructure/persistence/route-like.orm-entity';
import { TypeOrmCheckInRepository } from './infrastructure/persistence/typeorm-check-in.repository';
import { TypeOrmForumAnswerRepository } from './infrastructure/persistence/typeorm-forum-answer.repository';
import { TypeOrmRouteLikeRepository } from './infrastructure/persistence/typeorm-route-like.repository';
import { CHECK_IN_REPOSITORY } from './domain/check-in.repository.port';
import { FORUM_ANSWER_REPOSITORY } from './domain/forum-answer.repository.port';
import { ROUTE_LIKE_REPOSITORY } from './domain/route-like.repository.port';
import { UsersModule } from '../users/users.module';
import { TripsModule } from '../trips/trips.module';
import { MessagingModule } from '../messaging/messaging.module';

/**
 * Social / Traveler Buddy Finder. Serves the buddy list from the API so the
 * opt-in women-traveler filter can be enforced server-side (the frontend mock
 * stays as an offline fallback).
 *
 * ── The buddy-connection tables are gone ─────────────────────────────
 * `buddy_connections` recorded a link between an account and a demo profile —
 * a row nothing could ever read, since there was nobody on the other end. The
 * port, the entity, the repository and both endpoints were removed rather than
 * just hidden from the UI: an endpoint that persists a meaningless row is
 * still reachable by anyone willing to send the request, and hiding a button
 * has never been a rule. Real connections live in the messaging module, where
 * both sides are accounts and both have to agree.
 *
 * The table itself is left in the database, unread. Dropping it is a separate,
 * irreversible call and nothing depends on it being gone.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CheckInOrmEntity,
      ForumAnswerOrmEntity,
      RouteLikeOrmEntity,
    ]),
    UsersModule, // the caller's own safety preferences + travel styles
    TripsModule, // saved trips → preferred hubs + budget level (Görev 2)
    MessagingModule, // blocked accounts must not appear in the buddy list
  ],
  controllers: [SocialController],
  providers: [
    SocialService,
    MatchingService,
    CheckInsService,
    ForumService,
    CommunityRoutesService,
    { provide: CHECK_IN_REPOSITORY, useClass: TypeOrmCheckInRepository },
    { provide: FORUM_ANSWER_REPOSITORY, useClass: TypeOrmForumAnswerRepository },
    { provide: ROUTE_LIKE_REPOSITORY, useClass: TypeOrmRouteLikeRepository },
  ],
  exports: [SocialService, MatchingService, CheckInsService, ForumService, CommunityRoutesService],
})
export class SocialModule {}
