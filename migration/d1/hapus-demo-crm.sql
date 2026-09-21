-- ============================================================
-- HAPUS DATA DEMO CRM SALES
-- Jalankan kalau presentasi sudah selesai dan data demo mau dibuang.
--
--   npx wrangler d1 execute sph-management-db --remote --file=migration/d1/hapus-demo-crm.sql
--
-- Aman: hanya menghapus baris ber-id "demo-crm-", "demo-dok-", "demo-biaya-".
-- Data asli TIDAK tersentuh. Tabel referensi (kanal/sales/diskon/status) tidak dihapus.
-- ============================================================

DELETE FROM crm_lead_riwayat WHERE id_lead LIKE 'demo-crm-%';
DELETE FROM crm_dokumen      WHERE id_lead LIKE 'demo-crm-%';
DELETE FROM crm_leads        WHERE id        LIKE 'demo-crm-%';
DELETE FROM crm_biaya_iklan  WHERE id        LIKE 'demo-biaya-%';

-- Periksa hasilnya — semua harus 0
SELECT
  (SELECT COUNT(*) FROM crm_leads)         AS sisa_lead,
  (SELECT COUNT(*) FROM crm_lead_riwayat)  AS sisa_riwayat,
  (SELECT COUNT(*) FROM crm_dokumen)       AS sisa_dokumen,
  (SELECT COUNT(*) FROM crm_biaya_iklan)   AS sisa_biaya;
