CREATE TABLE IF NOT EXISTS quota_windows (
  key_hash TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK(count > 0),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS quota_expiry ON quota_windows(expires_at);
