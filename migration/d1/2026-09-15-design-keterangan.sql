-- Run once against the remote D1 database.
-- Adds keterangan (model/warna) column for design items.
ALTER TABLE design_items ADD COLUMN keterangan TEXT;
-- Backfill: struktur -> ambil warna dari nama (hapus prefix "Struktur ")
UPDATE design_items SET keterangan = TRIM(REPLACE(name, 'Struktur ', ''))
WHERE category = 'struktur' AND (keterangan IS NULL OR keterangan = '') AND name LIKE 'Struktur %';