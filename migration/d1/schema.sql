PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, user_id TEXT, full_name TEXT, email TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS user_roles (id TEXT PRIMARY KEY, user_id TEXT, role TEXT);
CREATE TABLE IF NOT EXISTS design_items (id TEXT PRIMARY KEY, category TEXT, name TEXT, sku TEXT, image_url TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, name TEXT, jabatan TEXT, signature_url TEXT, active INTEGER, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS sph (id TEXT PRIMARY KEY, user_id TEXT, nomor_sph TEXT UNIQUE, tanggal TEXT, kepada TEXT, nama_pic TEXT, alamat_proyek TEXT, perihal TEXT, jenis_lift TEXT, kapasitas TEXT, floors TEXT, stops TEXT, doors TEXT, waktu_pelaksanaan TEXT, items TEXT, specs TEXT, terms TEXT, payments TEXT, designs TEXT, include_ppn INTEGER, status TEXT, created_at TEXT, updated_at TEXT, nama_sales TEXT, price_mode TEXT, lump_sum_total TEXT);
CREATE INDEX IF NOT EXISTS idx_sph_user_id ON sph(user_id);
CREATE INDEX IF NOT EXISTS idx_sph_status ON sph(status);
CREATE INDEX IF NOT EXISTS idx_design_items_category ON design_items(category);
