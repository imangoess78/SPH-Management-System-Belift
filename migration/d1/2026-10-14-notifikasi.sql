-- ============================================================
--  NOTIFIKASI — pemberitahuan dalam aplikasi (lonceng)
--
--  Permintaan Mas: sistem harus memberi tahu orang yang tepat saat
--  alur proyek bergerak (lead baru, survey selesai, SPH/SPK final, PO
--  terbit, dokumen masuk). Tidak ada layanan email di aplikasi ini,
--  jadi semua pemberitahuan hidup di dalam aplikasi.
--
--  Dua tabel:
--    1. app_notifikasi        — isi pemberitahuan
--    2. app_notifikasi_baca   — siapa yang sudah membacanya
--
--  ── Keputusan penting: penerima disimpan EKSPLISIT per baris ──
--
--  Notifikasi TIDAK diarahkan lewat izin `lihat_semua`. Alasannya:
--  peran `staff` juga memegang `lihat_semua`, jadi staff akan menerima
--  seluruh pemberitahuan manajemen — kebanjiran yang membuat lonceng
--  tidak berguna. Penerima ditentukan per KEJADIAN (lihat
--  functions/lib/notifikasi.ts bagian `penerima()`), lalu disalin ke
--  baris `penerima` di sini. Jadi kalau suatu saat izin peran diubah,
--  notifikasi lama tetap menunjuk orang yang memang seharusnya tahu.
--
--  Kenapa tabel baca terpisah, bukan kolom `dibaca` di barisnya?
--  Karena satu kejadian bisa menyasar beberapa orang (mis. admin +
--  manager). Bila status baca ditulis di baris notifikasi, orang
--  pertama yang membuka akan menandainya terbaca untuk SEMUA orang.
--
--  Jejak pemicu disimpan (`jenis` + `id_ref`) supaya pemberitahuan
--  tidak dikirim dua kali untuk kejadian yang sama, mis. layar
--  menyimpan SPH dua kali.
-- ============================================================

-- ── 1. Isi pemberitahuan ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_notifikasi (
  id          TEXT PRIMARY KEY,
  -- Jenis kejadian. Nilai yang dipakai sekarang:
  --   'lead_baru' | 'lead_pindah' | 'lead_diskon' | 'survey_selesai'
  --   | 'survey_final_selesai' | 'survey_dikunci' | 'sph_final'
  --   | 'spk_final' | 'po_terbit' | 'po_revisi' | 'dokumen_baru'
  jenis       TEXT NOT NULL,
  -- Kunci kejadian: 'lead:<id>', 'sph:<id>', 'po:<id>' + rev, dst.
  -- Dipakai untuk mencegah pemberitahuan kembar.
  kunci_event TEXT NOT NULL,
  judul       TEXT NOT NULL,
  pesan       TEXT NOT NULL DEFAULT '',
  -- Penerima yang dituju (user_id app_users). Bisa berisi beberapa id
  -- dipisah koma — untuk pemberitahuan ke satu peran, mis. semua admin.
  penerima    TEXT NOT NULL,
  -- Tautan di dalam aplikasi, mis. '/crm/kanban'. Boleh kosong.
  tautan      TEXT NOT NULL DEFAULT '',
  -- Nama orang yang memicu kejadian, untuk kalimat "oleh ...".
  oleh_nama   TEXT NOT NULL DEFAULT '',
  -- 'info' | 'sukses' | 'peringatan' — menentukan warna lencana.
  tingkat     TEXT NOT NULL DEFAULT 'info',
  created_at  TEXT NOT NULL
);

-- Dua indeks yang mengikuti bentuk query yang benar-benar dipakai:
--   * daftar notifikasi saya  → WHERE penerima LIKE '%<id>%' ORDER BY created_at DESC
--   * cegah kembar            → WHERE kunci_event=?
CREATE INDEX IF NOT EXISTS idx_notif_penerima ON app_notifikasi(penerima);
CREATE INDEX IF NOT EXISTS idx_notif_kunci    ON app_notifikasi(kunci_event);
CREATE INDEX IF NOT EXISTS idx_notif_waktu    ON app_notifikasi(created_at);

-- ── 2. Status baca per orang ─────────────────────────────────
-- Satu baris = satu orang sudah membaca satu pemberitahuan.
CREATE TABLE IF NOT EXISTS app_notifikasi_baca (
  id_notif   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  dibaca_at  TEXT NOT NULL,
  PRIMARY KEY (id_notif, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_baca_user ON app_notifikasi_baca(user_id);
