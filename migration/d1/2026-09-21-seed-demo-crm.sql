-- ============================================================
-- DATA DEMO CRM SALES — 10 lead untuk presentasi fitur
-- Dibuat otomatis oleh scripts/gen-demo-crm.py — jangan diedit manual.
--
-- Ciri baris demo: id berawalan "demo-crm-" / "demo-biaya-" / "demo-dok-"
-- Cara menghapus: migration/d1/hapus-demo-crm.sql
-- ============================================================

DELETE FROM crm_lead_riwayat WHERE id_lead LIKE 'demo-crm-%';
DELETE FROM crm_dokumen      WHERE id_lead LIKE 'demo-crm-%';
DELETE FROM crm_leads        WHERE id        LIKE 'demo-crm-%';
DELETE FROM crm_biaya_iklan  WHERE id        LIKE 'demo-biaya-%';

-- ── 10 LEAD DEMO ─────────────────────────────────────────────
INSERT INTO crm_leads (id,kode_lead,waktu_masuk,kode_kanal,nama_prospek,no_hp,kota,kebutuhan,
  sales,metode_assign,butuh_jelas,lokasi_siap,budget_masuk,rencana_6bulan,bicara_decider,
  skor,kualifikasi,waktu_kontak_pertama,respons_jam,status_terakhir,no_sph,tgl_sph,nilai_sph,
  diskon_diminta,alasan_diskon,approver_wajib,status_approval,no_spk,tgl_spk,
  lokasi_gps,catatan,diubah_oleh,waktu_diubah,created_at,updated_at) VALUES
('demo-crm-01','LEAD-0001','2026-09-21T08:15:00.000Z','PAID-GA-S','Bpk. Hendra Wijaya','0812-1100-2233','Bekasi','Home lift 3 lantai, rumah baru','Arif','Round Robin','Ya','Ya','Ya','Ya','Ya',100,'HOT',NULL,NULL,'Lead Baru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'-6.2383, 106.9756','Baru masuk pagi ini. Prioritas dihubungi hari ini.','Arif','2026-09-21T08:15:00.000Z','2026-09-21T08:15:00.000Z','2026-09-21T08:15:00.000Z'),
('demo-crm-02','LEAD-0002','2026-09-20T14:30:00.000Z','ORG-IG','Ibu Ratna Sari','0813-2255-7788','Yogyakarta','Home lift 2 lantai, renovasi rumah','Dewo','Round Robin','Ya','Ya','Belum Jelas','Ya','Belum Jelas',60,'WARM','2026-09-20T15:05:00.000Z',0.58,'Kontak Pertama Dilakukan',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Sudah dihubungi, minta dikirim katalog dulu.','Dewo','2026-09-20T15:05:00.000Z','2026-09-20T14:30:00.000Z','2026-09-20T15:05:00.000Z'),
('demo-crm-03','LEAD-0003','2026-09-19T10:00:00.000Z','ORG-TT','Bpk. Slamet Riyadi','0857-3311-9900','Semarang','Tanya harga lift barang, masih cari-cari info','Firman','Manual','Ya','Tidak','Tidak','Belum Jelas','Tidak',20,'COLD','2026-09-19T13:20:00.000Z',3.33,'Survey Dijadwalkan',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Belum ada anggaran. Masih tahap informasi.','Firman','2026-09-20T09:00:00.000Z','2026-09-19T10:00:00.000Z','2026-09-20T09:00:00.000Z'),
('demo-crm-04','LEAD-0004','2026-09-17T09:00:00.000Z','AFF-ARS','PT Graha Karya Mandiri (Bpk. Yusuf)','0811-7788-4455','Surabaya','Passenger lift 4 lantai, gedung kantor baru','Imam','Manual','Ya','Ya','Ya','Ya','Belum Jelas',80,'HOT','2026-09-17T09:40:00.000Z',0.67,'Survey Selesai',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'-7.2575, 112.7521','Rujukan arsitek. Lokasi sudah disurvei, menunggu keputusan direksi.','Imam','2026-09-19T10:30:00.000Z','2026-09-17T09:00:00.000Z','2026-09-19T10:30:00.000Z'),
('demo-crm-05','LEAD-0005','2026-09-15T11:00:00.000Z','PAID-META-IG','Ibu Maya Kusuma','0812-9090-1212','Denpasar','Home lift 3 lantai, villa','Izzu','Round Robin','Ya','Ya','Ya','Ya','Ya',100,'HOT','2026-09-15T11:25:00.000Z',0.42,'SPH Terkirim','512/SPH/LIFT/BAI/IX/2026','2026-09-18',285000000,NULL,NULL,'Tidak Perlu',NULL,NULL,NULL,'-8.6705, 115.2126','SPH sudah dikirim, menunggu tanggapan.','Izzu','2026-09-18T10:00:00.000Z','2026-09-15T11:00:00.000Z','2026-09-18T10:00:00.000Z'),
('demo-crm-06','LEAD-0006','2026-09-14T08:30:00.000Z','PAID-GA-P','Bpk. Agus Setiawan','0813-4455-6677','Tangerang','Home lift 4 lantai + pit, rumah tinggal','Jihad','Round Robin','Ya','Ya','Ya','Belum Jelas','Ya',80,'HOT','2026-09-14T09:10:00.000Z',0.67,'Menunggu Approval Diskon','498/SPH/LIFT/BAI/IX/2026','2026-09-17',420000000,0.03,'Kompetitor menawarkan harga 3% lebih rendah','Sales Manager','Menunggu',NULL,NULL,'-6.1781, 106.6300','Minta potongan 3%, masih dalam wewenang Sales Manager.','Jihad','2026-09-19T09:00:00.000Z','2026-09-14T08:30:00.000Z','2026-09-19T09:00:00.000Z'),
('demo-crm-07','LEAD-0007','2026-09-12T09:15:00.000Z','PAID-GA-S','RSUD Sejahtera (Bpk. dr. Bayu)','0811-2233-4455','Bandung','4 unit bed lift rumah sakit, proyek pengadaan','Arif','Manual','Ya','Ya','Ya','Ya','Ya',100,'HOT','2026-09-12T09:35:00.000Z',0.33,'Menunggu Approval Diskon','476/SPH/LIFT/BAI/IX/2026','2026-09-16',1250000000,0.065,'Pengadaan pemerintah, butuh penyesuaian anggaran 6,5%','Direktur Operasional','Menunggu',NULL,NULL,'-6.9175, 107.6191','Proyek pengadaan, butuh penyesuaian anggaran.','Arif','2026-09-18T10:00:00.000Z','2026-09-12T09:15:00.000Z','2026-09-18T10:00:00.000Z'),
('demo-crm-08','LEAD-0008','2026-09-10T13:45:00.000Z','ORG-GBP','Hotel Nusantara (Ibu Dewi Lestari)','0812-5566-7788','Badung, Bali','2 unit lift hotel 5 lantai','Dewo','Manual','Ya','Ya','Belum Jelas','Belum Jelas','Tidak',40,'WARM','2026-09-10T15:30:00.000Z',1.75,'Menunggu Approval Diskon','461/SPH/LIFT/BAI/IX/2026','2026-09-15',890000000,0.12,'Permintaan manajemen hotel, harga pesaing 12% lebih rendah','Direktur','Menunggu',NULL,NULL,'-8.6500, 115.2167','Permintaan manajemen hotel. Di atas wewenang standar.','Dewo','2026-09-17T09:00:00.000Z','2026-09-10T13:45:00.000Z','2026-09-17T09:00:00.000Z'),
('demo-crm-09','LEAD-0009','2026-09-08T10:00:00.000Z','PAID-META-FB','Bpk. Tri Handoko','0813-9900-1122','Jakarta Selatan','Home lift 3 lantai, rumah tinggal','Firman','Round Robin','Ya','Ya','Ya','Ya','Ya',100,'HOT','2026-09-08T10:20:00.000Z',0.33,'Deal - Menunggu Dokumen','445/SPH/LIFT/BAI/IX/2026','2026-09-11',315000000,NULL,NULL,'Tidak Perlu',NULL,NULL,NULL,'-6.2615, 106.8106','Sudah deal. Menunggu dokumen SPK disusun admin.','Firman','2026-09-20T09:00:00.000Z','2026-09-08T10:00:00.000Z','2026-09-20T09:00:00.000Z'),
('demo-crm-10','LEAD-0010','2026-09-03T08:00:00.000Z','AFF-KON','Bpk. Edi Susanto','0811-3344-5566','Bekasi','Home lift 4 lantai, rumah tinggal','Imam','Manual','Ya','Ya','Ya','Ya','Ya',100,'HOT','2026-09-03T08:30:00.000Z',0.5,'SPK Ditandatangani + DP','402/SPH/LIFT/BAI/IX/2026','2026-09-05',365000000,NULL,NULL,'Tidak Perlu',NULL,'118/SPK/LIFT/BAI/IX/2026','2026-09-12','-6.2843, 106.9900','SPK sudah ditandatangani, DP diterima. Deal selesai.','Imam','2026-09-12T14:00:00.000Z','2026-09-03T08:00:00.000Z','2026-09-12T14:00:00.000Z');

-- ── JEJAK RIWAYAT (audit trail tiap lead) ───────────────────
INSERT INTO crm_lead_riwayat (id,id_lead,waktu,dari_status,ke_status,oleh,catatan) VALUES
('demo-crm-01-r01','demo-crm-01','2026-09-21T08:15:00.000Z',NULL,'Lead Baru','Arif','Lead dibuat dari Google Ads - Search'),
('demo-crm-02-r01','demo-crm-02','2026-09-20T14:30:00.000Z',NULL,'Lead Baru','Dewo','Lead dibuat dari DM Instagram'),
('demo-crm-02-r02','demo-crm-02','2026-09-20T15:05:00.000Z','Lead Baru','Kontak Pertama Dilakukan','Dewo','Dihubungi via WhatsApp, minta katalog'),
('demo-crm-03-r01','demo-crm-03','2026-09-19T10:00:00.000Z',NULL,'Lead Baru','Firman','Lead dibuat dari TikTok'),
('demo-crm-03-r02','demo-crm-03','2026-09-19T13:20:00.000Z','Lead Baru','Kontak Pertama Dilakukan','Firman','Dihubungi, masih cari info'),
('demo-crm-03-r03','demo-crm-03','2026-09-20T09:00:00.000Z','Kontak Pertama Dilakukan','Survey Dijadwalkan','Firman','Survey dijadwalkan pekan depan'),
('demo-crm-04-r01','demo-crm-04','2026-09-17T09:00:00.000Z',NULL,'Lead Baru','Imam','Lead dibuat dari rujukan arsitek'),
('demo-crm-04-r02','demo-crm-04','2026-09-17T09:40:00.000Z','Lead Baru','Kontak Pertama Dilakukan','Imam','Kontak via telepon'),
('demo-crm-04-r03','demo-crm-04','2026-09-18T08:00:00.000Z','Kontak Pertama Dilakukan','Survey Dijadwalkan','Imam','Jadwal survey disepakati'),
('demo-crm-04-r04','demo-crm-04','2026-09-19T10:30:00.000Z','Survey Dijadwalkan','Survey Selesai','Imam','Survey selesai, ukuran sudah diambil'),
('demo-crm-05-r01','demo-crm-05','2026-09-15T11:00:00.000Z',NULL,'Lead Baru','Izzu','Lead dibuat dari Meta Ads Instagram'),
('demo-crm-05-r02','demo-crm-05','2026-09-15T11:25:00.000Z','Lead Baru','Kontak Pertama Dilakukan','Izzu','Kontak via WhatsApp'),
('demo-crm-05-r03','demo-crm-05','2026-09-16T09:00:00.000Z','Kontak Pertama Dilakukan','Survey Dijadwalkan','Izzu','Jadwal survey disepakati'),
('demo-crm-05-r04','demo-crm-05','2026-09-17T11:00:00.000Z','Survey Dijadwalkan','Survey Selesai','Izzu','Survey selesai'),
('demo-crm-05-r05','demo-crm-05','2026-09-17T15:00:00.000Z','Survey Selesai','Hitung Harga 3 Lingkup','Izzu','Perhitungan 3 lingkup selesai'),
('demo-crm-05-r06','demo-crm-05','2026-09-18T10:00:00.000Z','Hitung Harga 3 Lingkup','SPH Terkirim','Izzu','SPH 512/SPH/LIFT/BAI/IX/2026 terkirim'),
('demo-crm-06-r01','demo-crm-06','2026-09-14T08:30:00.000Z',NULL,'Lead Baru','Jihad','Lead dibuat dari Google Ads - Performance Max'),
('demo-crm-06-r02','demo-crm-06','2026-09-14T09:10:00.000Z','Lead Baru','Kontak Pertama Dilakukan','Jihad','Kontak via telepon'),
('demo-crm-06-r03','demo-crm-06','2026-09-15T09:00:00.000Z','Kontak Pertama Dilakukan','Survey Dijadwalkan','Jihad','Jadwal survey disepakati'),
('demo-crm-06-r04','demo-crm-06','2026-09-16T10:00:00.000Z','Survey Dijadwalkan','Survey Selesai','Jihad','Survey selesai'),
('demo-crm-06-r05','demo-crm-06','2026-09-16T14:00:00.000Z','Survey Selesai','Hitung Harga 3 Lingkup','Jihad','Perhitungan selesai'),
('demo-crm-06-r06','demo-crm-06','2026-09-17T10:00:00.000Z','Hitung Harga 3 Lingkup','SPH Terkirim','Jihad','SPH terkirim'),
('demo-crm-06-r07','demo-crm-06','2026-09-18T13:00:00.000Z','SPH Terkirim','Negosiasi','Jihad','Prospek minta potongan harga'),
('demo-crm-06-r08','demo-crm-06','2026-09-19T09:00:00.000Z','Negosiasi','Menunggu Approval Diskon','Jihad','Pengajuan diskon 3% diajukan'),
('demo-crm-07-r01','demo-crm-07','2026-09-12T09:15:00.000Z',NULL,'Lead Baru','Arif','Lead dibuat dari Google Ads - Search'),
('demo-crm-07-r02','demo-crm-07','2026-09-12T09:35:00.000Z','Lead Baru','Kontak Pertama Dilakukan','Arif','Kontak via telepon'),
('demo-crm-07-r03','demo-crm-07','2026-09-13T09:00:00.000Z','Kontak Pertama Dilakukan','Survey Dijadwalkan','Arif','Jadwal survey disepakati'),
('demo-crm-07-r04','demo-crm-07','2026-09-14T13:00:00.000Z','Survey Dijadwalkan','Survey Selesai','Arif','Survey selesai, 4 titik terpasang'),
('demo-crm-07-r05','demo-crm-07','2026-09-15T10:00:00.000Z','Survey Selesai','Hitung Harga 3 Lingkup','Arif','Perhitungan 4 unit selesai'),
('demo-crm-07-r06','demo-crm-07','2026-09-16T09:00:00.000Z','Hitung Harga 3 Lingkup','SPH Terkirim','Arif','SPH terkirim ke bagian pengadaan'),
('demo-crm-07-r07','demo-crm-07','2026-09-17T14:00:00.000Z','SPH Terkirim','Negosiasi','Arif','Rapat anggaran dengan tim pengadaan'),
('demo-crm-07-r08','demo-crm-07','2026-09-18T10:00:00.000Z','Negosiasi','Menunggu Approval Diskon','Arif','Pengajuan diskon 6,5% diajukan'),
('demo-crm-08-r01','demo-crm-08','2026-09-10T13:45:00.000Z',NULL,'Lead Baru','Dewo','Lead dibuat dari Google Business Profile'),
('demo-crm-08-r02','demo-crm-08','2026-09-10T15:30:00.000Z','Lead Baru','Kontak Pertama Dilakukan','Dewo','Ditelepon langsung dari Maps'),
('demo-crm-08-r03','demo-crm-08','2026-09-11T09:00:00.000Z','Kontak Pertama Dilakukan','Survey Dijadwalkan','Dewo','Jadwal survey disepakati'),
('demo-crm-08-r04','demo-crm-08','2026-09-12T14:00:00.000Z','Survey Dijadwalkan','Survey Selesai','Dewo','Survey selesai'),
('demo-crm-08-r05','demo-crm-08','2026-09-13T10:00:00.000Z','Survey Selesai','Hitung Harga 3 Lingkup','Dewo','Perhitungan 2 unit selesai'),
('demo-crm-08-r06','demo-crm-08','2026-09-15T09:00:00.000Z','Hitung Harga 3 Lingkup','SPH Terkirim','Dewo','SPH terkirim ke manajemen'),
('demo-crm-08-r07','demo-crm-08','2026-09-16T11:00:00.000Z','SPH Terkirim','Negosiasi','Dewo','Negosiasi harga dengan manajemen'),
('demo-crm-08-r08','demo-crm-08','2026-09-17T09:00:00.000Z','Negosiasi','Menunggu Approval Diskon','Dewo','Pengajuan diskon 12% — di atas wewenang standar'),
('demo-crm-09-r01','demo-crm-09','2026-09-08T10:00:00.000Z',NULL,'Lead Baru','Firman','Lead dibuat dari Meta Ads Facebook'),
('demo-crm-09-r02','demo-crm-09','2026-09-08T10:20:00.000Z','Lead Baru','Kontak Pertama Dilakukan','Firman','Kontak via WhatsApp'),
('demo-crm-09-r03','demo-crm-09','2026-09-09T09:00:00.000Z','Kontak Pertama Dilakukan','Survey Dijadwalkan','Firman','Jadwal survey disepakati'),
('demo-crm-09-r04','demo-crm-09','2026-09-10T10:00:00.000Z','Survey Dijadwalkan','Survey Selesai','Firman','Survey selesai'),
('demo-crm-09-r05','demo-crm-09','2026-09-10T15:00:00.000Z','Survey Selesai','Hitung Harga 3 Lingkup','Firman','Perhitungan selesai'),
('demo-crm-09-r06','demo-crm-09','2026-09-11T09:00:00.000Z','Hitung Harga 3 Lingkup','SPH Terkirim','Firman','SPH terkirim'),
('demo-crm-09-r07','demo-crm-09','2026-09-12T10:00:00.000Z','SPH Terkirim','Negosiasi','Firman','Prospek minta waktu pertimbangan'),
('demo-crm-09-r08','demo-crm-09','2026-09-20T09:00:00.000Z','Negosiasi','Deal - Menunggu Dokumen','Firman','Prospek setuju, lanjut ke dokumen SPK'),
('demo-crm-10-r01','demo-crm-10','2026-09-03T08:00:00.000Z',NULL,'Lead Baru','Imam','Lead dibuat dari rujukan kontraktor'),
('demo-crm-10-r02','demo-crm-10','2026-09-03T08:30:00.000Z','Lead Baru','Kontak Pertama Dilakukan','Imam','Kontak via telepon'),
('demo-crm-10-r03','demo-crm-10','2026-09-04T09:00:00.000Z','Kontak Pertama Dilakukan','Survey Dijadwalkan','Imam','Jadwal survey disepakati'),
('demo-crm-10-r04','demo-crm-10','2026-09-05T10:00:00.000Z','Survey Dijadwalkan','Survey Selesai','Imam','Survey selesai'),
('demo-crm-10-r05','demo-crm-10','2026-09-05T14:00:00.000Z','Survey Selesai','Hitung Harga 3 Lingkup','Imam','Perhitungan selesai'),
('demo-crm-10-r06','demo-crm-10','2026-09-05T16:00:00.000Z','Hitung Harga 3 Lingkup','SPH Terkirim','Imam','SPH 402/SPH/LIFT/BAI/IX/2026 terkirim'),
('demo-crm-10-r07','demo-crm-10','2026-09-08T10:00:00.000Z','SPH Terkirim','Negosiasi','Imam','Negosiasi harga dan jadwal pemasangan'),
('demo-crm-10-r08','demo-crm-10','2026-09-09T09:00:00.000Z','Negosiasi','Deal - Menunggu Dokumen','Imam','Prospek setuju, lanjut ke dokumen'),
('demo-crm-10-r09','demo-crm-10','2026-09-10T09:00:00.000Z','Deal - Menunggu Dokumen','SPK Disusun','Imam','SPK mulai disusun admin'),
('demo-crm-10-r10','demo-crm-10','2026-09-11T10:00:00.000Z','SPK Disusun','SPK Bernomor & Terkirim','Imam','SPK bernomor 118/SPK/LIFT/BAI/IX/2026'),
('demo-crm-10-r11','demo-crm-10','2026-09-12T14:00:00.000Z','SPK Bernomor & Terkirim','SPK Ditandatangani + DP','Imam','SPK ditandatangani, DP diterima');

-- ── BIAYA IKLAN September 2026 (dasar CPL/CAC/ROAS) ─────────
INSERT INTO crm_biaya_iklan (id,periode,kode_kanal,biaya,catatan,created_at,updated_at) VALUES
('demo-biaya-01','2026-09','PAID-GA-S',8500000,'Google Ads - Search, September 2026','2026-09-21T07:00:00.000Z','2026-09-21T07:00:00.000Z'),
('demo-biaya-02','2026-09','PAID-GA-P',4000000,'Google Ads - Performance Max, September 2026','2026-09-21T07:00:00.000Z','2026-09-21T07:00:00.000Z'),
('demo-biaya-03','2026-09','PAID-META-IG',3200000,'Meta Ads Instagram, September 2026','2026-09-21T07:00:00.000Z','2026-09-21T07:00:00.000Z'),
('demo-biaya-04','2026-09','PAID-META-FB',2800000,'Meta Ads Facebook, September 2026','2026-09-21T07:00:00.000Z','2026-09-21T07:00:00.000Z'),
('demo-biaya-05','2026-09','AFF-ARS',1500000,'Fee arsitek — 1 closing','2026-09-21T07:00:00.000Z','2026-09-21T07:00:00.000Z'),
('demo-biaya-06','2026-09','AFF-KON',1000000,'Fee kontraktor — 1 closing','2026-09-21T07:00:00.000Z','2026-09-21T07:00:00.000Z');

-- ── MEJA DOKUMEN (1 lewat SLA + 2 selesai tepat waktu) ─────
INSERT INTO crm_dokumen (id,id_lead,jenis_dokumen,masuk_meja,sla_jam,target_selesai,selesai,
  lama_jam,status_sla,pic_admin,no_dokumen_terbit,catatan,created_at,updated_at) VALUES
('demo-dok-01','demo-crm-09','SPK Induk','2026-09-20T09:00:00.000Z',24,'2026-09-21T09:00:00.000Z',NULL,NULL,'Menunggu diproses','Abiyya',NULL,'Belum diproses — menunggu kelengkapan berkas dari sales','2026-09-20T09:00:00.000Z','2026-09-20T09:00:00.000Z'),
('demo-dok-02','demo-crm-10','SPK Induk','2026-09-12T09:00:00.000Z',24,'2026-09-13T09:00:00.000Z','2026-09-12T21:00:00.000Z',12.0,'Selesai tepat waktu','Abiyya','118/SPK/LIFT/BAI/IX/2026','Selesai lebih cepat dari SLA','2026-09-12T09:00:00.000Z','2026-09-12T21:00:00.000Z'),
('demo-dok-03','demo-crm-10','SPK Final','2026-09-14T09:00:00.000Z',24,'2026-09-15T09:00:00.000Z','2026-09-15T04:00:00.000Z',19.0,'Selesai tepat waktu','Abiyya','118/SPK/LIFT/BAI/IX/2026','Berkas final lengkap','2026-09-14T09:00:00.000Z','2026-09-15T04:00:00.000Z');
