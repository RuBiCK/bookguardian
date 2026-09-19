import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Postgres/MySQL suites share one database, so files must not interleave.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Entry points only wire things up; schema files are declarative tables
      // whose shape is asserted by test/schema-parity.test.ts.
      exclude: ['src/index.ts', 'src/cli/**', 'src/db/schema/**'],
      reporter: ['text', 'lcov'],
      // Postgres/MySQL kits are only executed when TEST_*_URL is set (CI does),
      // so the function threshold leaves room for a SQLite-only local run.
      thresholds: { lines: 90, functions: 80, branches: 85, statements: 90 },
    },
  },
});
