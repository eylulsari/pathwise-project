import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline schema — the thirteen tables that never had a migration.
 *
 * ── Why this exists ──────────────────────────────────────────────────
 * Development runs with `DB_SYNCHRONIZE=true`, so TypeORM created these
 * tables from the entities and nobody noticed they had no migration. The
 * migrations that DO exist only ever add to that base: the very first one is
 * `ALTER TABLE "users"`. On a production database with synchronize off, that
 * ALTER is the first statement to run and there is no `users` table to alter,
 * so the deploy dies with `42P01 relation "users" does not exist` before a
 * single table is created.
 *
 * This migration is dated BEFORE `1730000000000-AddSubscriptionTierToUsers`
 * so a clean database builds the base first and the existing migrations then
 * apply on top, exactly as their names describe.
 *
 * ── It is deliberately the *pre-migration* shape ─────────────────────
 * `users` here does NOT have `subscriptionTier`, the women-traveler
 * preferences, or `points` — those are added by the later migrations that
 * already exist and say so. Duplicating them here would make those
 * migrations no-ops and lose the history of when each arrived.
 * `trialEndsAt` IS here, because no migration ever added it.
 *
 * ── Safe on databases that already ran the others ────────────────────
 * Every statement is `IF NOT EXISTS`. An existing dev database (where
 * synchronize already built everything and all six migrations are recorded)
 * runs this afterwards as a no-op.
 *
 * TODO(schema): once this has been applied everywhere, new tables should get
 * their CREATE in a migration at the time they are added — not left to
 * synchronize — or this gap simply reopens.
 */
export class CreateBaselineSchema1729999000000 implements MigrationInterface {
  name = 'CreateBaselineSchema1729999000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── users ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(120) NOT NULL,
        "email" character varying(255) NOT NULL,
        "passwordHash" character varying(255) NOT NULL,
        "nationality" character varying(80),
        "age" integer,
        "travelStyles" jsonb NOT NULL DEFAULT '[]',
        "bio" text,
        "trialEndsAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")`,
    );

    // ── trips ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trips" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "title" character varying(160) NOT NULL,
        "hub" character varying(40) NOT NULL,
        "totalDistanceKm" real NOT NULL DEFAULT 0,
        "totalCostTry" integer NOT NULL DEFAULT 0,
        "stopCount" integer NOT NULL DEFAULT 0,
        "itinerary" jsonb NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trips" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_trips_userId" ON "trips" ("userId")`,
    );

    // ── place_reviews ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "place_reviews" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "authorName" character varying(120) NOT NULL,
        "placeId" character varying(120) NOT NULL,
        "rating" integer NOT NULL,
        "comment" text NOT NULL,
        "helpfulCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_place_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_place_reviews_user_place" UNIQUE ("userId", "placeId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_place_reviews_placeId" ON "place_reviews" ("placeId")`,
    );

    // ── trip_journal_entries ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trip_journal_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "placeId" character varying(120) NOT NULL,
        "photoUrl" text,
        "note" text,
        "rating" integer NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trip_journal_entries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_trip_journal_entries_user_place" UNIQUE ("userId", "placeId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_trip_journal_entries_userId" ON "trip_journal_entries" ("userId")`,
    );

    // ── content_reports ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "content_reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "reporterUserId" uuid NOT NULL,
        "contentType" character varying(16) NOT NULL,
        "contentId" character varying(120) NOT NULL,
        "reason" character varying(300) NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'open',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_content_reports" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_content_reports_status" ON "content_reports" ("status")`,
    );

    // ── affiliate_clicks ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "affiliate_clicks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "tourId" character varying(120) NOT NULL,
        "source" character varying(40) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_affiliate_clicks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_affiliate_clicks_userId" ON "affiliate_clicks" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_affiliate_clicks_tourId" ON "affiliate_clicks" ("tourId")`,
    );

    // ── sos_alerts ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sos_alerts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "lat" double precision NOT NULL,
        "lng" double precision NOT NULL,
        "sharedWithUserIds" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sos_alerts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sos_alerts_userId" ON "sos_alerts" ("userId")`,
    );

    // ── notifications ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "type" character varying(20) NOT NULL,
        "title" character varying(160) NOT NULL,
        "body" character varying(300) NOT NULL,
        "read" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_userId" ON "notifications" ("userId")`,
    );

    // ── notification_preferences ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_preferences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "muted" jsonb NOT NULL DEFAULT '[]',
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_notification_preferences_userId" ON "notification_preferences" ("userId")`,
    );

    // ── polls ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "polls" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "creatorUserId" uuid NOT NULL,
        "question" character varying(200) NOT NULL,
        "options" jsonb NOT NULL,
        "status" character varying(10) NOT NULL DEFAULT 'open',
        "winnerPlaceId" character varying(120),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_polls" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_polls_creatorUserId" ON "polls" ("creatorUserId")`,
    );

    // ── poll_votes ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "poll_votes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pollId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "optionId" character varying(40) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_poll_votes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_poll_votes_poll_user" UNIQUE ("pollId", "userId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_poll_votes_pollId" ON "poll_votes" ("pollId")`,
    );

    // ── referral_codes ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "referral_codes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "code" character varying(16) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_referral_codes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_referral_codes_userId" ON "referral_codes" ("userId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_referral_codes_code" ON "referral_codes" ("code")`,
    );

    // ── referral_redemptions ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "referral_redemptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(16) NOT NULL,
        "referrerUserId" uuid NOT NULL,
        "newUserId" uuid NOT NULL,
        "rewardDays" integer NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_referral_redemptions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_referral_redemptions_referrerUserId" ON "referral_redemptions" ("referrerUserId")`,
    );
    // One redemption per new user — the rule the service relies on.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_referral_redemptions_newUserId" ON "referral_redemptions" ("newUserId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse creation order. The later migrations' tables are dropped by
    // their own down() — this only removes what it made.
    for (const table of [
      'referral_redemptions',
      'referral_codes',
      'poll_votes',
      'polls',
      'notification_preferences',
      'notifications',
      'sos_alerts',
      'affiliate_clicks',
      'content_reports',
      'trip_journal_entries',
      'place_reviews',
      'trips',
      'users',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
  }
}
