PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS accounts(uid TEXT PRIMARY KEY, code_hash TEXT UNIQUE, code_expires INTEGER, credential_hash TEXT UNIQUE, last_upload_at INTEGER);
CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY, uid TEXT NOT NULL UNIQUE, list_name TEXT NOT NULL, items TEXT NOT NULL, uploaded_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS snapshots_expiry ON snapshots(expires_at);
CREATE TABLE IF NOT EXISTS acknowledgements(id TEXT PRIMARY KEY, uid TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS acknowledgements_expiry ON acknowledgements(expires_at);
CREATE TABLE IF NOT EXISTS rates(subject TEXT NOT NULL, action TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(subject,action,bucket));
