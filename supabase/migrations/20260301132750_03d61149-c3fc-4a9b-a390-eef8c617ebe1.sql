
-- SPH table
CREATE TABLE public.sph (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nomor_sph TEXT NOT NULL,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  kepada TEXT NOT NULL DEFAULT '',
  nama_pic TEXT NOT NULL DEFAULT '',
  alamat_proyek TEXT NOT NULL DEFAULT '',
  perihal TEXT NOT NULL DEFAULT 'Penawaran Harga Pengadaan & Pemasangan Lift',
  jenis_lift TEXT NOT NULL DEFAULT 'Passenger Lift',
  kapasitas INTEGER NOT NULL DEFAULT 630,
  floors INTEGER NOT NULL DEFAULT 5,
  stops INTEGER NOT NULL DEFAULT 5,
  doors INTEGER NOT NULL DEFAULT 5,
  waktu_pelaksanaan TEXT NOT NULL DEFAULT '90 Hari Kerja',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  specs JSONB NOT NULL DEFAULT '[]'::jsonb,
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  payments JSONB NOT NULL DEFAULT '[]'::jsonb,
  include_ppn BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.sph ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own SPH" ON public.sph
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own SPH" ON public.sph
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own SPH" ON public.sph
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own SPH" ON public.sph
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all SPH" ON public.sph
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER update_sph_updated_at
  BEFORE UPDATE ON public.sph
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Design items table
CREATE TABLE public.design_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.design_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view design items" ON public.design_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert design items" ON public.design_items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update design items" ON public.design_items
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete design items" ON public.design_items
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_design_items_updated_at
  BEFORE UPDATE ON public.design_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for design images
INSERT INTO storage.buckets (id, name, public) VALUES ('design-images', 'design-images', true);

CREATE POLICY "Anyone can view design images" ON storage.objects
  FOR SELECT USING (bucket_id = 'design-images');

CREATE POLICY "Authenticated users can upload design images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'design-images');

CREATE POLICY "Authenticated users can delete design images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'design-images');
