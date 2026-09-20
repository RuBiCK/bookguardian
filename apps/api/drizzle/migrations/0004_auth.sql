-- Accounts (BOOK-13): Google sign-in, database sessions, one account per email.
--
--   users            gains email_verified, avatar_url and last_login_at, plus a
--                    UNIQUE index on email. The column stays nullable in DDL:
--                    the local user created by earlier seeds has no email until
--                    the first Google login claims it (see ADR 0005), and every
--                    engine treats NULLs as distinct in a unique index. The API
--                    never creates a user without an email any more.
--   auth_identities  one row per (provider, subject) — the stable id Google
--                    gives an account — pointing at the user it belongs to.
--   sessions         server-side sessions; the cookie carries a random token
--                    and only its SHA-256 is stored.
--
-- Same portability rules as 0001_initial.sql: VARCHAR/TEXT/INTEGER only,
-- ISO-8601 timestamps as VARCHAR(32), no dialect-specific SQL.

ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(2048) NULL;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN last_login_at VARCHAR(32) NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX uq_users_email ON users (email);
--> statement-breakpoint
CREATE TABLE auth_identities (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  provider_subject VARCHAR(255) NOT NULL,
  email_at_link VARCHAR(254) NULL,
  created_at VARCHAR(32) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_auth_identities_subject UNIQUE (provider, provider_subject),
  CONSTRAINT fk_auth_identities_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX idx_auth_identities_user ON auth_identities (user_id);
--> statement-breakpoint
CREATE TABLE sessions (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  expires_at VARCHAR(32) NOT NULL,
  last_seen_at VARCHAR(32) NOT NULL,
  user_agent VARCHAR(512) NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_sessions_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX idx_sessions_user ON sessions (user_id);
