# ScamGiveawaysBot: report status migration

The `scam_reports.status` field is required by moderation, publishing, and statistics. Do not drop it.

The desired definition is:

```sql
status TEXT NOT NULL DEFAULT 'pending_review'
```

The Serverless schema now declares `text('status').notNull().default('pending_review')`. If the CLI classifies this field as a manual change, inspect the live table first and apply only the matching case below in the bot's SQLite database.

## 1. Inspect the live column

Run:

```sql
PRAGMA table_info('scam_reports');
```

Check whether a row named `status` exists and whether its `notnull` and `dflt_value` fields match the desired definition.

## 2A. If the status column is missing

Run this once:

```sql
ALTER TABLE scam_reports
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending_review';
```

Then create the index if it is not already present:

```sql
CREATE INDEX IF NOT EXISTS idx_scam_reports_status
ON scam_reports(status);
```

SQLite populates existing rows with the non-NULL default, so old reports become pending review.

## 2B. If the status column already exists but contains NULL values

Run:

```sql
UPDATE scam_reports
SET status = 'pending_review'
WHERE status IS NULL;
```

Then verify the data:

```sql
SELECT COUNT(*) AS null_status_count
FROM scam_reports
WHERE status IS NULL;
```

The result must be `0`.

If `PRAGMA table_info` shows that the existing column is nullable or has no default, the backfill alone does not fix the column definition. Use this table rebuild to enforce the desired definition while preserving report IDs, report contents, timestamps, review metadata, and all indexes:

```sql
BEGIN IMMEDIATE;

CREATE TABLE scam_reports_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL,
  scammer_handle TEXT NOT NULL,
  amount TEXT NOT NULL,
  summary TEXT NOT NULL,
  proof_channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  reviewed_by INTEGER,
  reviewed_at INTEGER,
  published_chat_id TEXT,
  published_message_id INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO scam_reports_new (
  id, reporter_id, scammer_handle, amount, summary, proof_channel,
  status, reviewed_by, reviewed_at, published_chat_id,
  published_message_id, created_at
)
SELECT
  id, reporter_id, scammer_handle, amount, summary, proof_channel,
  COALESCE(status, 'pending_review'), reviewed_by, reviewed_at,
  published_chat_id, published_message_id, created_at
FROM scam_reports;

DROP TABLE scam_reports;
ALTER TABLE scam_reports_new RENAME TO scam_reports;

CREATE INDEX idx_scam_reports_reporter ON scam_reports(reporter_id);
CREATE INDEX idx_scam_reports_created ON scam_reports(created_at);
CREATE INDEX idx_scam_reports_status ON scam_reports(status);

COMMIT;
```

Only use this rebuild when `status` already exists and the live definition does not match. If the column is absent, use section 2A instead. Run it as one transaction and take a database backup first. Do not execute both paths.

## 3. Verify and finish

Run:

```sql
SELECT status, COUNT(*) AS reports
FROM scam_reports
GROUP BY status;

PRAGMA index_list('scam_reports');
```

Confirm there are no NULL statuses and that `idx_scam_reports_status` exists. Then rerun `npx tgcloud migrate` and confirm the status column is in sync.

**Important:** this file documents the SQL; it has not been run against the live bot database. Deploying `schema.js` and applying a database migration are separate operations. Never run the `ALTER TABLE` statement if `status` already exists.
