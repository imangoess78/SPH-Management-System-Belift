-- ============================================================
-- CRM LEADS & MEJA DOKUMEN — modul baru untuk sph.belift.co.id
-- Sumber struktur: BELIFT_Sumber_Data_AppSheet.xlsx (8 sheet)
-- Modul ini BERDIRI SENDIRI: tidak menyentuh tabel sph/spk/sales
-- yang sudah ada. Tidak ada sinkronisasi ke sistem lain.
--
-- Jalankan sekali:
--   npx wrangler d1 execute sph-management-db --remote --file=migration/d1/2026-09-21-crm-leads.sql
-- ============================================================

-- ── 1. REF_KANAL — daftar kanal masuknya lead ────────────────
CREATE TABLE IF NOT EXISTS crm_ref_kanal (
  kode        TEXT PRIMARY KEY,
  kelompok    TEXT NOT NULL,          -- Organik | Paid | Affiliate | Offline | Lainnya
  kanal       TEXT NOT NULL,
  keterangan  TEXT,
  aktif       INTEGER DEFAULT 1,
  urutan      INTEGER DEFAULT 0
);

-- ── 2. REF_SALES — daftar orang + peran + kuota ──────────────
CREATE TABLE IF NOT EXISTS crm_ref_sales (
  id          TEXT PRIMARY KEY,
  nama        TEXT NOT NULL,
  email       TEXT,
  peran       TEXT NOT NULL DEFAULT 'Sales',   -- Sales | Admin | Manager | Direktur
  status      TEXT DEFAULT 'Aktif',
  wilayah     TEXT,
  bobot       REAL DEFAULT 100,                -- bobot distribusi round-robin
  kuota_aktif INTEGER DEFAULT 40,              -- maks lead aktif
  catatan     TEXT,
  created_at  TEXT,
  updated_at  TEXT
);

-- ── 3. REF_DISKON — jenjang approval diskon ──────────────────
CREATE TABLE IF NOT EXISTS crm_ref_diskon (
  id             TEXT PRIMARY KEY,
  batas_bawah    REAL NOT NULL,
  batas_atas     REAL NOT NULL,
  approver       TEXT NOT NULL,
  email_approver TEXT,
  catatan        TEXT
);

-- ── 4. REF_STATUS — status + urutan tahap + pemilik ──────────
CREATE TABLE IF NOT EXISTS crm_ref_status (
  status      TEXT PRIMARY KEY,
  urutan      INTEGER NOT NULL,
  pemilik     TEXT,
  keterangan  TEXT
);

-- ── 5. LEADS — tabel utama (1 baris = 1 prospek) ─────────────
CREATE TABLE IF NOT EXISTS crm_leads (
  id                    TEXT PRIMARY KEY,
  kode_lead             TEXT,
  waktu_masuk           TEXT,
  kode_kanal            TEXT,
  nama_prospek          TEXT NOT NULL,
  no_hp                 TEXT,
  kota                  TEXT,
  kebutuhan             TEXT,
  sales                 TEXT,
  metode_assign         TEXT,      -- Round Robin | Manual
  -- 5 kriteria kualifikasi (Ya | Tidak | Belum Jelas)
  butuh_jelas           TEXT,
  lokasi_siap           TEXT,
  budget_masuk          TEXT,
  rencana_6bulan        TEXT,
  bicara_decider        TEXT,
  -- dihitung otomatis oleh server
  skor                  INTEGER DEFAULT 0,
  kualifikasi           TEXT,      -- HOT | WARM | COLD
  waktu_kontak_pertama  TEXT,
  respons_jam           REAL,
  status_terakhir       TEXT,
  no_sph                TEXT,
  tgl_sph               TEXT,
  nilai_sph             REAL,      -- diisi MANUAL oleh sales (Rp)
  diskon_diminta        REAL,      -- 0.05 = 5%
  alasan_diskon         TEXT,
  approver_wajib        TEXT,
  status_approval       TEXT,
  tgl_approval          TEXT,
  no_spk                TEXT,
  tgl_spk               TEXT,
  alasan_gugur          TEXT,
  foto_lokasi           TEXT,      -- JSON array [{key,nama}]
  lokasi_gps            TEXT,
  catatan               TEXT,
  diubah_oleh           TEXT,
  waktu_diubah          TEXT,
  created_at            TEXT,
  updated_at            TEXT
);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status   ON crm_leads(status_terakhir);
CREATE INDEX IF NOT EXISTS idx_crm_leads_sales    ON crm_leads(sales);
CREATE INDEX IF NOT EXISTS idx_crm_leads_kanal    ON crm_leads(kode_kanal);
CREATE INDEX IF NOT EXISTS idx_crm_leads_masuk    ON crm_leads(waktu_masuk);
CREATE INDEX IF NOT EXISTS idx_crm_leads_kual     ON crm_leads(kualifikasi);

-- ── 6. DOKUMEN — antrean admin (SPK & lampiran) ──────────────
CREATE TABLE IF NOT EXISTS crm_dokumen (
  id                 TEXT PRIMARY KEY,
  id_lead            TEXT NOT NULL,
  jenis_dokumen      TEXT,
  masuk_meja         TEXT,
  sla_jam            REAL DEFAULT 24,
  target_selesai     TEXT,
  selesai            TEXT,
  lama_jam           REAL,
  status_sla         TEXT,
  pic_admin          TEXT,
  no_dokumen_terbit  TEXT,
  catatan            TEXT,
  created_at         TEXT,
  updated_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_crm_dokumen_lead ON crm_dokumen(id_lead);

-- ── 7. BIAYA_IKLAN — biaya per bulan per kanal (dasar CPL/CAC)
CREATE TABLE IF NOT EXISTS crm_biaya_iklan (
  id          TEXT PRIMARY KEY,
  periode     TEXT NOT NULL,       -- YYYY-MM
  kode_kanal  TEXT NOT NULL,
  biaya       REAL NOT NULL DEFAULT 0,
  catatan     TEXT,
  created_at  TEXT,
  updated_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_crm_biaya_periode ON crm_biaya_iklan(periode, kode_kanal);

-- ── 8. RIWAYAT LEAD — jejak perubahan status (audit) ─────────
CREATE TABLE IF NOT EXISTS crm_lead_riwayat (
  id          TEXT PRIMARY KEY,
  id_lead     TEXT NOT NULL,
  waktu       TEXT,
  dari_status TEXT,
  ke_status   TEXT,
  oleh        TEXT,
  catatan     TEXT
);
CREATE INDEX IF NOT EXISTS idx_crm_riwayat_lead ON crm_lead_riwayat(id_lead);

-- ============================================================
-- SEED REF_KANAL (23 kanal dari file client)
-- ============================================================
INSERT OR IGNORE INTO crm_ref_kanal (kode,kelompok,kanal,keterangan,aktif,urutan) VALUES
 ('ORG-IG','Organik','Instagram','DM / komentar / link bio',1,10),
 ('ORG-TT','Organik','TikTok','DM / komentar',1,20),
 ('ORG-YT','Organik','YouTube','Komentar / deskripsi',1,30),
 ('ORG-FB','Organik','Facebook','DM / komentar / grup',1,40),
 ('ORG-WEB','Organik','Website belift.co.id','Form kontak / WA button',1,50),
 ('ORG-GBP','Organik','Google Business Profile','Maps / telepon langsung',1,60),
 ('ORG-WA','Organik','WhatsApp langsung','Nomor tersebar / word of mouth',1,70),
 ('PAID-GA-S','Paid','Google Ads - Search','Kata kunci pencarian',1,110),
 ('PAID-GA-P','Paid','Google Ads - Performance Max','Otomatis lintas properti Google',1,120),
 ('PAID-GA-D','Paid','Google Ads - Display/YouTube','Banner / video',1,130),
 ('PAID-META-IG','Paid','Meta Ads - Instagram','Feed / story / reels',1,140),
 ('PAID-META-FB','Paid','Meta Ads - Facebook','Feed / marketplace',1,150),
 ('PAID-TT','Paid','TikTok Ads','For You / Spark Ads',1,160),
 ('AFF-ARS','Affiliate','Arsitek','Fee per closing',1,210),
 ('AFF-KON','Affiliate','Kontraktor / Mandor','Fee per closing',1,220),
 ('AFF-INT','Affiliate','Interior Designer','Fee per closing',1,230),
 ('AFF-AGN','Affiliate','Agen Properti','Fee per closing',1,240),
 ('AFF-CUS','Affiliate','Mantan Customer','Referral',1,250),
 ('OFF-SHW','Offline','Showroom Depok','Walk-in',1,310),
 ('OFF-SBY','Offline','Showroom Surabaya','Walk-in',1,320),
 ('OFF-PAM','Offline','Pameran / Event','Booth',1,330),
 ('OFF-TND','Offline','Tender / Undangan','Institusi / korporat',1,340),
 ('LAIN','Lainnya','Belum teridentifikasi','WAJIB ditelusuri, jangan jadi tempat buangan',1,900);

-- ============================================================
-- SEED REF_SALES (10 orang dari file client)
-- ============================================================
INSERT OR IGNORE INTO crm_ref_sales (id,nama,email,peran,status,wilayah,bobot,kuota_aktif,catatan) VALUES
 ('cs-firman','Firman','firman@belift.co.id','Sales','Aktif','Jabodetabek + Bali',100,40,NULL),
 ('cs-imam','Imam','imam@belift.co.id','Sales','Aktif','Jabodetabek + Nasional',100,40,NULL),
 ('cs-dewo','Dewo','dewo@belift.co.id','Sales','Aktif','Jabodetabek',100,40,NULL),
 ('cs-arif','Arif','arif@belift.co.id','Sales','Aktif','Jawa Timur (Surabaya)',100,40,NULL),
 ('cs-jihad','Jihad','jihad@belift.co.id','Sales','Aktif','Jabodetabek',100,40,NULL),
 ('cs-izzu','Izzu','izzu@belift.co.id','Sales','Aktif','Jabodetabek',100,40,NULL),
 ('cs-abiyya','Abiyya','abiyya@belift.co.id','Admin','Aktif','-',0,0,'Admin Sales — pemegang Meja Dokumen'),
 ('cs-manager','Sales Manager','salesmanager@belift.co.id','Manager','Aktif','-',0,0,'Lihat semua lead, berwenang re-assign'),
 ('cs-coo','Direktur Operasional','coo@belift.co.id','Direktur','Aktif','-',0,0,'Approver diskon >3% s/d 8%'),
 ('cs-dirut','Direktur Utama','dirut@belift.co.id','Direktur','Aktif','-',0,0,'Approver diskon >8%');

-- ============================================================
-- SEED REF_DISKON (jenjang approval)
-- ============================================================
INSERT OR IGNORE INTO crm_ref_diskon (id,batas_bawah,batas_atas,approver,email_approver,catatan) VALUES
 ('cd-0',0.0,0.0,'Tidak Perlu','imam@belift.co.id','Harga standar. Tidak ada pengurangan margin.'),
 ('cd-3',0.0,0.03,'Sales Manager','salesmanager@belift.co.id','Sampai 3%. Margin kotor turun sekitar 2 poin dari 30% ke 28%.'),
 ('cd-8',0.03,0.08,'Direktur Operasional','coo@belift.co.id','Di atas 3% s/d 8%. Pada 8% margin kotor turun ke sekitar 24% — di bawah target RUPS 30-40%.'),
 ('cd-100',0.08,1.0,'Direktur','dirut@belift.co.id','Di atas 8% di luar kewenangan standar. Wajib disertai perhitungan ulang RAB.');

-- ============================================================
-- SEED REF_STATUS (15 status + urutan tahap)
-- ============================================================
INSERT OR IGNORE INTO crm_ref_status (status,urutan,pemilik,keterangan) VALUES
 ('Lead Baru',10,'Sales','Belum dihubungi sama sekali'),
 ('Kontak Pertama Dilakukan',20,'Sales','Sudah dihubungi, kualifikasi diisi'),
 ('Survey Dijadwalkan',30,'Sales',NULL),
 ('Survey Selesai',40,'Sales',NULL),
 ('Hitung Harga 3 Lingkup',50,'Sales','Lift, sipil, kelistrikan'),
 ('SPH Terkirim',60,'Sales',NULL),
 ('Negosiasi',70,'Sales',NULL),
 ('Menunggu Approval Diskon',80,'Sales','Menunggu approver di REF_DISKON'),
 ('Deal - Menunggu Dokumen',90,'Sales','Pemicu pembuatan baris di DOKUMEN'),
 ('SPK Disusun',100,'Admin','Dikerjakan di tabel DOKUMEN'),
 ('SPK Bernomor & Terkirim',110,'Admin','Dikerjakan di tabel DOKUMEN'),
 ('SPK Ditandatangani + DP',120,'Operasional',NULL),
 ('KOM Terjadwal',130,'Operasional',NULL),
 ('Selesai - Pindah ke File 00',140,'Operasional','Catatan berhenti hidup di sini'),
 ('Gugur',900,'Sales','Wajib isi Alasan Gugur');
