# Contributing to Pathwise

## Commit convention — Conventional Commits + scope

```
<type>(<scope>): <short description>
```

**Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `build`,
`ci`, `chore`, `revert`

**Scopes:** `auth`, `itinerary`, `map`, `quiz`, `route-gen`, `social`,
`profile`, `db`, `docker`, `deps`, `repo`

**Examples**

```
feat(auth): add JWT refresh-token rotation via Redis
fix(map): call invalidateSize after fullscreen toggle
refactor(route-gen): extract HubBudgetStrategy from generator service
docs(repo): add ARCHITECTURE overview
```

## Branch naming

```
feature/<scope>-<short-description>
fix/<scope>-<short-description>
```

Examples: `feature/auth-refresh-tokens`, `fix/map-resize`.

## Database migrations

Dev runs with `DB_SYNCHRONIZE=true`, so TypeORM creates and alters tables from
the entities automatically and **you will not notice a missing migration
locally**. Production sets `DB_SYNCHRONIZE=false` and applies migrations only.
Every schema change therefore needs a migration written by hand, or it simply
never reaches production.

**Where they live:** `pathwise-backend/src/infrastructure/database/migrations/`

**Naming:** `<timestamp>-<PascalCaseName>.ts`, and the class inside must repeat
the same name plus the timestamp:

```ts
export class CreateCheckIns1730000003000 implements MigrationInterface {
  name = 'CreateCheckIns1730000003000';
  public async up(queryRunner: QueryRunner): Promise<void> { /* … */ }
  public async down(queryRunner: QueryRunner): Promise<void> { /* … */ }
}
```

The timestamps in this repo are hand-assigned and spaced by 1000
(`…000`, `…001000`, `…002000`, `…003000`) rather than generated. Keep going up;
the number is what orders them.

**Conventions the existing four follow:**

- **Idempotent DDL** — `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`. A dev database that `synchronize` already
  touched must not make the migration explode.
- **Always write `down()`.** It is the only thing that makes a bad deploy
  reversible.
- **Raw SQL, not the query builder.** A migration is a historical record: it
  must keep meaning what it meant even after the entity it came from changes.
- **Index what you sort or filter by**, and say which query it serves in a
  comment.
- **Explain the column, not the syntax.** Nullability especially — e.g. why
  `identifiesAsWoman` is nullable (NULL is "not stated", distinct from `false`)
  or why `check_ins.placeId` is not a foreign key (places are an in-memory
  dataset, not a table).

**Running them:**

```bash
cd pathwise-backend
npm run migration:run      # builds, then applies against DATA_SOURCE
npm run migration:revert    # rolls the last one back
```

Add the entity to its feature module with `TypeOrmModule.forFeature([…])` —
`autoLoadEntities` picks it up from there — and bind its repository port to the
TypeORM adapter in the same module.

## Rules

- One logical change per commit.
- Keep the subject line ≤ 72 chars, imperative mood.
- Run `npm run lint` and the relevant tests before committing.
- Don't change a major architectural decision (removing a pattern, swapping a
  library) without flagging it first.
