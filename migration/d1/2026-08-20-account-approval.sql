-- Run once against the remote D1 database.
ALTER TABLE app_users ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE app_users ADD COLUMN approved_at TEXT;
ALTER TABLE app_users ADD COLUMN approved_by TEXT;
ALTER TABLE app_users ADD COLUMN rejection_reason TEXT;
UPDATE app_users SET status='approved' WHERE status IS NULL OR status='';
