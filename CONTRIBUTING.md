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

## Rules

- One logical change per commit.
- Keep the subject line ≤ 72 chars, imperative mood.
- Run `npm run lint` and the relevant tests before committing.
- Don't change a major architectural decision (removing a pattern, swapping a
  library) without flagging it first.
