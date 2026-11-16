-- ============================================================
--  Kalkulator Dinamis — konfigurasi harga yang bisa diedit admin
--
--  Tabel ini menyimpan SATU baris konfigurasi (id = 'utama') berisi JSON.
--  Sengaja disimpan sebagai JSON, bukan kolom per angka: bentuk
--  konfigurasinya bertingkat (daftar kabin, pintu, lokasi, add-on) dan akan
--  terus berkembang. Memecahnya jadi puluhan kolom berarti setiap opsi baru
--  menuntut migrasi baru.
--
--  Siapa pun yang punya izin `kalkulator` boleh MEMBACA (kalkulator perlu
--  jalan), hanya peran dengan izin `master` yang boleh MENULIS — dijaga di
--  functions/api/kalkulator.ts, bukan di sini.
--
--  Baris awal sengaja TIDAK diisi: server memakai KONFIG_BAWAAN dari
--  shared/kalkulator-konfigurasi.ts selama tabel ini kosong, sehingga
--  kalkulator sudah benar sejak detik pertama deploy dan belum ada satu pun
--  harga yang "berubah" di riwayat.
-- ============================================================

CREATE TABLE IF NOT EXISTS kalkulator_konfigurasi (
  id               TEXT PRIMARY KEY,          -- selalu 'utama'
  isi              TEXT NOT NULL,             -- JSON KonfigKalkulator
  versi            INTEGER NOT NULL DEFAULT 1,
  diperbarui_oleh  TEXT,                      -- email admin yang terakhir menyimpan
  diperbarui_pada  TEXT NOT NULL
);

-- Riwayat perubahan harga.
--
-- Wajib ada, bukan pelengkap: harga lift berubah tanpa jejak adalah masalah
-- bisnis (SPH lama vs baru tidak bisa dijelaskan), dan tanpa riwayat satu
-- kesalahan ketik admin tidak bisa ditelusuri. Setiap simpan menulis satu
-- baris berisi daftar perubahan (dari → ke) dalam bentuk JSON.
CREATE TABLE IF NOT EXISTS kalkulator_riwayat (
  id         TEXT PRIMARY KEY,
  waktu      TEXT NOT NULL,
  oleh       TEXT,
  versi      INTEGER NOT NULL,
  ringkasan  TEXT NOT NULL                    -- JSON: [{jalur, dari, ke}]
);

CREATE INDEX IF NOT EXISTS idx_kalkulator_riwayat_waktu
  ON kalkulator_riwayat (waktu DESC);
