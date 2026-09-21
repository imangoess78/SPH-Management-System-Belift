-- ============================================================
-- HAK AKSES CRM untuk akun yang sudah ada + bersihkan akun uji
--
-- Kenapa perlu: peran CRM ditentukan dengan mencocokkan email login
-- ke tabel crm_ref_sales. Kalau email tidak ada di situ, pengguna
-- dianggap "Sales" dan hanya melihat lead atas namanya sendiri —
-- halaman Leads akan tampak kosong.
--
-- Jalankan:
--   npx wrangler d1 execute sph-management-db --remote --file=migration/d1/crm-akses-akun.sql
-- ============================================================

-- Akun Mas nur -> Manager (bisa lihat & ubah semua lead, termasuk setujui diskon)
INSERT OR REPLACE INTO crm_ref_sales (id,nama,email,peran,status,wilayah,bobot,kuota_aktif,catatan,created_at,updated_at) VALUES
 ('rs-manager-utama','Admin','imangoess78@gmail.com','Manager','Aktif',NULL,100,40,'Akun pengelola sistem','2026-09-21T07:00:00.000Z','2026-09-21T07:00:00.000Z'),
 ('rs-admin-iyanz','Iyanz','iyanz35@gmail.com','Admin','Aktif',NULL,100,40,'Akun admin Meja Dokumen','2026-09-21T07:00:00.000Z','2026-09-21T07:00:00.000Z');

-- Hapus akun uji sementara yang dipakai untuk verifikasi
DELETE FROM app_sessions WHERE user_id='demo-verif-akun';
DELETE FROM app_users    WHERE id='demo-verif-akun';

-- Periksa: peran tiap akun
SELECT nama, email, peran, status FROM crm_ref_sales ORDER BY peran, nama;
