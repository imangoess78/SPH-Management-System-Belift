-- ════════════════════════════════════════════════════════════
--  PERLUAS PERAN YANG DIIZINKAN
--
--  Skema lama membatasi role hanya ke ('admin','staff'). Akibatnya peran
--  sales / manager / direktur TIDAK BISA disimpan sama sekali — fitur hak
--  akses per peran akan gagal dengan CHECK constraint.
--
--  SQLite tidak bisa mengubah CHECK lewat ALTER TABLE, jadi tabelnya
--  dibuat ulang lalu datanya dipindahkan. Urutannya penting: buat baru →
--  pindahkan → hapus lama → ganti nama.
-- ════════════════════════════════════════════════════════════

CREATE TABLE app_users_baru (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff'
    CHECK (role IN ('admin','direktur','manager','sales','staff')),
  full_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  approved_at TEXT,
  approved_by TEXT,
  rejection_reason TEXT,
  permissions TEXT DEFAULT NULL
);

INSERT INTO app_users_baru
  (id, email, password_hash, role, full_name, created_at, updated_at,
   status, approved_at, approved_by, rejection_reason, permissions)
SELECT
  id, email, password_hash, role, full_name, created_at, updated_at,
  status, approved_at, approved_by, rejection_reason, permissions
FROM app_users;

DROP TABLE app_users;

ALTER TABLE app_users_baru RENAME TO app_users;

-- Sesi mengacu ke user_id; pastikan tidak ada sesi yatim setelah pemindahan.
DELETE FROM app_sessions
WHERE user_id NOT IN (SELECT id FROM app_users);

CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
