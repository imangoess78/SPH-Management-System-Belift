-- ============================================================================
--  PRD — Survey Sales, Final Survey & PO Pabrik
--  Migrasi ADITIF. Tidak ada DROP, tidak ada UPDATE massal, tidak ada
--  perubahan pada kolom/tabel lama. Aman dijalankan berulang (idempoten).
--
--  Catatan: SQLite/D1 tidak mendukung "ALTER TABLE ... ADD COLUMN IF NOT EXISTS".
--  Kolom tambahan pada tabel lama dikerjakan scripts/migrate-survey-po.mjs
--  lewat pengecekan PRAGMA table_info.
-- ============================================================================

-- ── 1. survey_teknis : satu baris per proyek per jenis survey ──────────────
CREATE TABLE IF NOT EXISTS survey_teknis (
  id                 TEXT PRIMARY KEY,
  id_lead            TEXT NOT NULL,          -- FK → crm_leads.id
  kode_proyek        TEXT,                   -- BLF-2026-001
  jenis              TEXT NOT NULL,          -- 'sales' | 'final'
  no_survey          TEXT,                   -- nomor form survey
  tgl_survey         TEXT,
  surveyor           TEXT,                   -- nama surveyor (Final Survey)
  disurvey_oleh      TEXT,                   -- nama sales (Survey Sales)
  pj_lapangan        TEXT,
  pj_telp            TEXT,
  jam_kerja          TEXT,
  -- Data teknis 57 field + tabel lantai + add-on (JSON, lihat PRD D1)
  dt                 TEXT,
  -- Bagian form survey
  dokumentasi        TEXT,                   -- JSON [{no,judul,ada,foto:[{key,nama}]}]
  video_link         TEXT,
  pekerjaan_tambahan TEXT,                   -- JSON [{nama,on,ket}]
  catatan_lapangan   TEXT,
  catatan_desain     TEXT,
  kesimpulan         TEXT,                   -- JSON [{q,jawab,alasan}]
  ttd                TEXT,                   -- JSON {sales,customer,surveyor}
  -- Pengesahan
  terkunci           INTEGER DEFAULT 0,
  dikunci_oleh       TEXT,
  dikunci_pada       TEXT,
  status             TEXT DEFAULT 'Draft',   -- Draft | Terkunci
  dibuat_oleh        TEXT,
  diubah_oleh        TEXT,
  created_at         TEXT,
  updated_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_survey_lead  ON survey_teknis(id_lead);
CREATE INDEX IF NOT EXISTS idx_survey_jenis ON survey_teknis(id_lead, jenis);

-- ── 2. po_pabrik : pemesanan ke pabrik ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS po_pabrik (
  id              TEXT PRIMARY KEY,
  id_lead         TEXT NOT NULL,
  kode_proyek     TEXT,
  no_po           TEXT,
  tgl_po          TEXT,
  pabrik          TEXT,
  pic             TEXT,
  rev_terakhir    INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'Draft',      -- Draft | Terbit
  catatan         TEXT,
  dibuat_oleh     TEXT,
  created_at      TEXT,
  updated_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_po_lead ON po_pabrik(id_lead);

-- ── 3. po_revisi : tiap PO terbit = satu baris revisi (salinan + selisih) ──
CREATE TABLE IF NOT EXISTS po_revisi (
  id                      TEXT PRIMARY KEY,
  id_po                   TEXT NOT NULL,     -- FK → po_pabrik.id
  rev                     INTEGER NOT NULL,
  tgl_revisi              TEXT,
  oleh                    TEXT,
  alasan                  TEXT,
  dt                      TEXT,              -- snapshot data teknis saat PO ini
  perubahan               TEXT,              -- JSON [{field,lama,baru}]
  jml_perubahan           INTEGER DEFAULT 0,
  perubahan_setelah_final INTEGER DEFAULT 0,
  created_at              TEXT
);
CREATE INDEX IF NOT EXISTS idx_rev_po ON po_revisi(id_po, rev);

-- ── 4. proyek : kunci penghubung lead ↔ seluruh tahap ─────────────────────
CREATE TABLE IF NOT EXISTS proyek (
  id              TEXT PRIMARY KEY,
  kode_proyek     TEXT UNIQUE,               -- BLF-2026-001
  id_lead         TEXT NOT NULL,
  nama_proyek     TEXT,
  customer        TEXT,
  kota            TEXT,
  status_terakhir TEXT,
  tahap_sekarang  TEXT,                      -- CRM | Survey | SPH | SPK | FinalSurvey | PO
  created_at      TEXT,
  updated_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_proyek_lead ON proyek(id_lead);
CREATE INDEX IF NOT EXISTS idx_proyek_kode ON proyek(kode_proyek);

-- ── 5. survey_riwayat : log kunci / buka kunci / revisi (PRD aturan S6) ────
CREATE TABLE IF NOT EXISTS survey_riwayat (
  id         TEXT PRIMARY KEY,
  jenis      TEXT NOT NULL,                  -- survey | po
  id_ref     TEXT NOT NULL,                  -- id survey / id po
  aksi       TEXT NOT NULL,                  -- Dibuat | Diubah | Dikunci | Dibuka | Terbit | Revisi
  oleh       TEXT,
  alasan     TEXT,
  catatan    TEXT,
  waktu      TEXT
);
CREATE INDEX IF NOT EXISTS idx_sriwayat_ref ON survey_riwayat(jenis, id_ref);

-- ── 6. Status pipeline baru (PRD 9.6) — status lama tidak diubah ───────────
INSERT OR IGNORE INTO crm_ref_status (status, urutan, pemilik, keterangan) VALUES
  ('Final Survey Dijadwalkan', 121, 'Operasional', 'Setelah SPK ditandatangani'),
  ('Final Survey Selesai',     122, 'Operasional', 'Data final siap PO'),
  ('PO Terbit ke Pabrik',      125, 'Operasional', 'PO dikirim ke pabrik');

-- ── 7. Data referensi baru (PRD 9.8) ───────────────────────────────────────
--  Peran 'Surveyor' = peran baru, berhak mengunci Final Survey.
--  Peran 'Operasional' = PIC PO Pabrik.
INSERT OR IGNORE INTO crm_ref_sales (id, nama, email, peran, status, wilayah, bobot, kuota_aktif, catatan, created_at, updated_at) VALUES
  ('cs-surveyor-rohim', 'Rohim', 'rohim@belift.co.id', 'Surveyor', 'Aktif', '-', 0, 0,
   'Surveyor — berhak mengunci Final Survey', '2026-09-29T00:00:00.000Z', '2026-09-29T00:00:00.000Z'),
  ('cs-pic-po-sholahuddin', 'Sholahuddin Asy Syamil', 'pabrik@belift.co.id', 'Operasional', 'Aktif', '-', 0, 0,
   'PIC PO Pabrik — penerbit PO ke pabrik', '2026-09-29T00:00:00.000Z', '2026-09-29T00:00:00.000Z');
