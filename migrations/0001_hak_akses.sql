-- ════════════════════════════════════════════════════════════
--  HAK AKSES PER AKUN
--
--  Kolom `permissions` menyimpan daftar izin khusus (JSON array).
--  NULL  = pakai bawaan peran (lihat shared/akses.ts)
--  '[]'  = sengaja dikosongkan, tanpa izin
--
--  Sengaja dibedakan dari NULL: "belum diatur" dan "sengaja tidak diberi
--  apa-apa" adalah dua hal berbeda. Kalau keduanya jadi NULL, admin yang
--  mengosongkan semua centang akan diam-diam mendapat izin penuh kembali.
-- ════════════════════════════════════════════════════════════

ALTER TABLE app_users ADD COLUMN permissions TEXT DEFAULT NULL;

-- Jejak perubahan hak akses. Hak akses adalah kontrol keamanan, jadi
-- perubahan siapa-boleh-apa harus bisa ditelusuri.
CREATE TABLE IF NOT EXISTS app_users_izin_riwayat (
  id            TEXT PRIMARY KEY,
  id_user       TEXT NOT NULL,
  oleh_user_id  TEXT,
  oleh_nama     TEXT,
  role_lama     TEXT,
  role_baru     TEXT,
  izin_lama     TEXT,
  izin_baru     TEXT,
  dibuat_pada   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_izin_riwayat_user ON app_users_izin_riwayat(id_user, dibuat_pada DESC);
