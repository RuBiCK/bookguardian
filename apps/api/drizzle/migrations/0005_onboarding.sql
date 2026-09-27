-- In-app onboarding (BOOK-35): remember, per account, that the first-session
-- tour has been seen.
--
--   users.onboarding_completed_at  ISO-8601 timestamp of the moment the tour
--                                  was finished or skipped (the two count the
--                                  same); NULL = still pending, which is what
--                                  makes the SPA open it. Nullable on purpose:
--                                  every account that predates this migration
--                                  is pending, and so is every new one.
--
-- The state lives on the account rather than in the browser so "do not show me
-- this again" travels from the phone to the laptop.
--
-- Same portability rules as 0001_initial.sql: VARCHAR/TEXT/INTEGER only,
-- ISO-8601 timestamps as VARCHAR(32), no dialect-specific SQL.

ALTER TABLE users ADD COLUMN onboarding_completed_at VARCHAR(32) NULL;
