-- ============================================================
--  GANTI PASSWORD MANDIRI + LUPA PASSWORD (TANPA EMAIL)
--
--  Aplikasi ini tidak punya layanan email, jadi "lupa password"
--  tidak bisa lewat tautan surel. Gantinya: Admin membuat KODE
--  SEKALI PAKAI, lalu menyampaikannya ke pemilik akun (WhatsApp /
--  lisan). Pemilik akun memasukkan kode itu di halaman login.
--
--  Tiga tabel:
--   1. app_reset_kode        — kode reset (hanya HASH-nya disimpan)
--   2. app_percobaan         — pembatas percobaan (rate limit)
--   3. app_keamanan_riwayat  — jejak audit: siapa mengganti apa, kapan
--
--  Prinsip yang dijaga skema ini:
--   * Kode mentah TIDAK PERNAH masuk database. Kalau DB bocor, kode
--     itu tidak bisa dipakai (sama seperti password_hash).
--   * Satu akun hanya punya SATU kode hidup. Kode baru membatalkan
--     kode lama, supaya tidak ada dua kode beredar sekaligus.
--   * Kode punya masa berlaku, dan hanya bisa dipakai SEKALI.
--   * Pembatas percobaan disimpan di D1, bukan di memori Worker —
--     Worker punya banyak isolate, penghitung di memori bocor.
-- ============================================================

-- ── 1. Kode reset password sekali pakai ──────────────────────
CREATE TABLE IF NOT EXISTS app_reset_kode (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  -- Format: '<garam>$<base64(pbkdf2)>' — sama seperti app_users.password_hash.
  kode_hash     TEXT NOT NULL,
  dibuat_oleh   TEXT NOT NULL DEFAULT '',
  dibuat_nama   TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  -- NULL = belum dipakai. Diisi = sudah dipakai, tidak bisa dipakai lagi.
  dipakai_at    TEXT DEFAULT NULL,
  -- NULL = masih berlaku. Diisi = dibatalkan (mis. ada kode yang lebih baru).
  dibatalkan_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_reset_kode_user    ON app_reset_kode(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_kode_expires ON app_reset_kode(expires_at);

-- ── 2. Pembatas percobaan (rate limit) ───────────────────────
CREATE TABLE IF NOT EXISTS app_percobaan (
  -- Contoh kunci: 'lupa:ip:1.2.3.4' / 'lupa:akun:a@b.c:1.2.3.4' / 'sandi:u-123'
  kunci    TEXT PRIMARY KEY,
  jumlah   INTEGER NOT NULL DEFAULT 0,
  reset_at TEXT NOT NULL
);

-- ── 3. Riwayat keamanan akun ─────────────────────────────────
-- Menjawab pertanyaan yang pasti muncul: "kok password saya berubah?"
CREATE TABLE IF NOT EXISTS app_keamanan_riwayat (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL DEFAULT '',
  email        TEXT NOT NULL DEFAULT '',
  -- 'kode_reset_dibuat' | 'password_direset' | 'password_diubah'
  jenis        TEXT NOT NULL,
  oleh_user_id TEXT NOT NULL DEFAULT '',
  oleh_nama    TEXT NOT NULL DEFAULT '',
  catatan      TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_keamanan_user ON app_keamanan_riwayat(user_id);
CREATE INDEX IF NOT EXISTS idx_keamanan_waktu ON app_keamanan_riwayat(created_at);
