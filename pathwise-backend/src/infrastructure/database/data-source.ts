import { DataSource } from 'typeorm';

/**
 * Standalone TypeORM DataSource for the migration CLI (production path).
 * Dev uses `synchronize: true`; prod sets `DB_SYNCHRONIZE=false` and runs
 * migrations:  `npm run migration:run`.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  username: process.env.POSTGRES_USER ?? 'pathwise',
  password: process.env.POSTGRES_PASSWORD ?? 'pathwise_dev_password',
  database: process.env.POSTGRES_DB ?? 'pathwise',
  entities: ['dist/**/*.orm-entity.js'],
  migrations: ['dist/infrastructure/database/migrations/*.js'],
  synchronize: false,
  // Mirrors DatabaseModule: managed Postgres usually needs TLS, and the CLI
  // runs migrations against the same server the app will connect to.
  ssl:
    process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
