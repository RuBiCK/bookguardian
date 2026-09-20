-- Reading life: when a book was started, alongside the existing read_at.
--
-- Same portability rules as 0001: plain ALTER TABLE ... ADD COLUMN with a
-- NULL-able VARCHAR is accepted verbatim by SQLite, Postgres and MySQL.
-- Re-reads (a per-book history of start/finish pairs) are intentionally not
-- modelled yet; see docs/data-model.md.

ALTER TABLE books ADD COLUMN started_at VARCHAR(10) NULL;
