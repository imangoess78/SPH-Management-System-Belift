-- Fix defaults, types, and nullability for design_items and sph tables

-- DESIGN ITEMS
ALTER TABLE public.design_items
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN sku SET DEFAULT '';

-- SPH: ensure numeric columns are numeric
ALTER TABLE public.sph
  ALTER COLUMN kapasitas TYPE integer USING NULLIF(kapasitas, '')::integer,
  ALTER COLUMN doors TYPE integer USING NULLIF(doors, '')::integer;

-- Backfill values
UPDATE public.sph
SET
  tanggal = COALESCE(tanggal, CURRENT_DATE),
  kepada = COALESCE(kepada, ''),
  nama_pic = COALESCE(nama_pic, ''),
  alamat_proyek = COALESCE(alamat_proyek, ''),
  perihal = COALESCE(perihal, 'Penawaran Harga Pengadaan & Pemasangan Lift'),
  jenis_lift = COALESCE(jenis_lift, 'Passenger Lift'),
  kapasitas = COALESCE(kapasitas, 630),
  floors = COALESCE(floors, 5),
  stops = COALESCE(stops, 5),
  doors = COALESCE(doors, 5),
  waktu_pelaksanaan = COALESCE(waktu_pelaksanaan, '90 Hari Kerja'),
  items = COALESCE(items, '[]'::jsonb),
  specs = COALESCE(specs, '[]'::jsonb),
  terms = COALESCE(terms, '{}'::jsonb),
  payments = COALESCE(payments, '[]'::jsonb),
  designs = COALESCE(designs, '{}'::jsonb),
  include_ppn = COALESCE(include_ppn, true),
  status = COALESCE(status, 'draft');

-- Set defaults
ALTER TABLE public.sph
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN tanggal SET DEFAULT CURRENT_DATE,
  ALTER COLUMN kepada SET DEFAULT '',
  ALTER COLUMN nama_pic SET DEFAULT '',
  ALTER COLUMN alamat_proyek SET DEFAULT '',
  ALTER COLUMN perihal SET DEFAULT 'Penawaran Harga Pengadaan & Pemasangan Lift',
  ALTER COLUMN jenis_lift SET DEFAULT 'Passenger Lift',
  ALTER COLUMN kapasitas SET DEFAULT 630,
  ALTER COLUMN floors SET DEFAULT 5,
  ALTER COLUMN stops SET DEFAULT 5,
  ALTER COLUMN doors SET DEFAULT 5,
  ALTER COLUMN waktu_pelaksanaan SET DEFAULT '90 Hari Kerja',
  ALTER COLUMN items SET DEFAULT '[]'::jsonb,
  ALTER COLUMN specs SET DEFAULT '[]'::jsonb,
  ALTER COLUMN terms SET DEFAULT '{}'::jsonb,
  ALTER COLUMN payments SET DEFAULT '[]'::jsonb,
  ALTER COLUMN designs SET DEFAULT '{}'::jsonb,
  ALTER COLUMN include_ppn SET DEFAULT true,
  ALTER COLUMN status SET DEFAULT 'draft';

-- Enforce NOT NULL for required fields
ALTER TABLE public.sph
  ALTER COLUMN tanggal SET NOT NULL,
  ALTER COLUMN kepada SET NOT NULL,
  ALTER COLUMN nama_pic SET NOT NULL,
  ALTER COLUMN alamat_proyek SET NOT NULL,
  ALTER COLUMN perihal SET NOT NULL,
  ALTER COLUMN jenis_lift SET NOT NULL,
  ALTER COLUMN kapasitas SET NOT NULL,
  ALTER COLUMN floors SET NOT NULL,
  ALTER COLUMN stops SET NOT NULL,
  ALTER COLUMN doors SET NOT NULL,
  ALTER COLUMN waktu_pelaksanaan SET NOT NULL,
  ALTER COLUMN items SET NOT NULL,
  ALTER COLUMN specs SET NOT NULL,
  ALTER COLUMN terms SET NOT NULL,
  ALTER COLUMN payments SET NOT NULL,
  ALTER COLUMN designs SET NOT NULL,
  ALTER COLUMN include_ppn SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;
