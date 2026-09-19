# ADR 0002 — Database adapter layer and portable migrations

- Status: accepted
- Date: 2026-09-19

## Context

The API must run on SQLite by default and on Postgres or MySQL by flipping a
single `DB_DRIVER` env var, with **one** migration set. Application code must
never contain raw driver-specific SQL.

Drizzle ORM is dialect-specific by design: `sqliteTable`, `pgTable` and
`mysqlTable` produce different types, `drizzle-kit` generates a different SQL
migration per dialect, and the three `drizzle()` database objects are not
interchangeable at the type level (a union of them is not callable). A naive
"write the repository once against Drizzle" approach therefore does not
compile, and "generate migrations per dialect" violates the one-migration-set
rule.

## Decision

### 1. A thin dialect-neutral `DialectKit` is the boundary

`apps/api/src/db/adapters/types.ts` defines:

```ts
interface DialectKit {
  select(table, { where, orderBy, limit, offset });
  insert(table, values);
  update(table, values, where);
  delete(table, where);
  execute(rawDdl); // migrations only
  transaction(fn);
}
```

`adapters/sqlite.ts`, `adapters/postgres.ts` and `adapters/mysql.ts` each
implement it in ~60 lines with their own Drizzle driver; that is the only place
a dialect-specific query builder is touched. `adapters/index.ts` picks one from
`DB_DRIVER`.

### 2. Repositories are written once

`apps/api/src/db/repositories/*` take `(kit, tables)` and use Drizzle's
dialect-agnostic operators (`eq`, `and`, `asc`, `isNull`, …) to build `where`
clauses. They never import a driver. Ids are generated client-side (UUID) so an
insert never needs `RETURNING` (MySQL lacks it) — create, then read back by id.

### 3. Three Drizzle schemas, one logical shape

`apps/api/src/db/schema/{sqlite,postgres,mysql}.ts` declare the same tables and
column names with dialect-appropriate column builders. `Tables` is the union of
the three; because the property names and row types match, repository code is
valid against any of them. A unit test (`schema-parity.test.ts`) asserts the
three schemas have identical table/column/nullability sets and that every
column appears in the migration SQL.

### 4. Hand-written portable SQL migrations

`apps/api/drizzle/migrations/*.sql` are written by hand in the subset of SQL
that SQLite, Postgres and MySQL 8 all accept, split with drizzle's
`--> statement-breakpoint` marker, and executed through `kit.execute` by
`src/db/migrate.ts`. Applied files are recorded in `schema_migrations`.

Portability rules the migrations follow:

- `VARCHAR(36)` ids (UUID strings), `VARCHAR(n)` for bounded text, `TEXT` for
  long text, `INTEGER` for numbers.
- Timestamps are ISO-8601 strings in `VARCHAR(32)`, dates are `VARCHAR(10)`.
- Arrays (`authors`, `categories`) are JSON in `TEXT`, decoded by a Drizzle
  `customType` so repositories see `string[]`.
- Foreign keys are table-level `CONSTRAINT … FOREIGN KEY` (MySQL ignores inline
  `REFERENCES`); the SQLite adapter turns `PRAGMA foreign_keys` on.
- No `CREATE INDEX IF NOT EXISTS` (unsupported by MySQL 8); idempotency comes
  from the `schema_migrations` ledger instead.

`drizzle-kit` is intentionally not used to generate migrations; it may be used
locally for `studio` against the SQLite schema.

## Consequences

- Adding a table means touching four files (three schema files + one SQL
  migration); the parity test catches drift.
- The kit is deliberately small (no joins yet). When a feature needs a join or
  aggregate, extend `DialectKit` with a portable operation rather than reaching
  for a dialect builder in a repository.
- Storing timestamps as text forgoes native date types and timezone handling in
  Postgres/MySQL; ordering and comparisons still work because ISO-8601 sorts
  lexically. Revisit with a new ADR if reporting needs native date arithmetic.
- Every database test runs against SQLite locally and against SQLite, Postgres
  16 and MySQL 8.4 in CI (`describeEachAdapter` in `apps/api/test/adapters.ts`),
  so a migration or repository change that is not portable fails the PR.
