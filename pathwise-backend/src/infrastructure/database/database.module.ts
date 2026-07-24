import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * TypeORM / PostgreSQL wiring.
 *
 * `autoLoadEntities` picks up every entity registered by a feature module via
 * `TypeOrmModule.forFeature([...])`, so the domain modules stay self-contained.
 * `synchronize` is driven by DB_SYNCHRONIZE (dev only — use migrations in prod).
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('POSTGRES_HOST', 'localhost'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        username: config.get<string>('POSTGRES_USER', 'pathwise'),
        password: config.get<string>('POSTGRES_PASSWORD', 'pathwise_dev_password'),
        database: config.get<string>('POSTGRES_DB', 'pathwise'),
        autoLoadEntities: true,
        synchronize: config.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
      }),
    }),
  ],
})
export class DatabaseModule {}
