-- ============================================================
-- Create sales table for managing sales representatives
-- with their signature images
-- ============================================================

CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  jabatan TEXT NOT NULL DEFAULT 'Sales',
  signature_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user can read sales
CREATE POLICY "sales_select"
  ON public.sales FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: admin or staff
CREATE POLICY "sales_insert"
  ON public.sales FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
  );

-- UPDATE: admin or staff
CREATE POLICY "sales_update"
  ON public.sales FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
  );

-- DELETE: admin or staff
CREATE POLICY "sales_delete"
  ON public.sales FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
  );

-- Trigger updated_at
CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Storage bucket for signature images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('signatures', 'signatures', true)
  ON CONFLICT (id) DO NOTHING;

-- Anyone can VIEW signatures (needed for public img tags in PDF)
CREATE POLICY "signatures_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'signatures');

-- Authenticated users can UPLOAD
CREATE POLICY "signatures_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'signatures');

-- Authenticated users can UPDATE (replace)
CREATE POLICY "signatures_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'signatures');

-- Authenticated users can DELETE
CREATE POLICY "signatures_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'signatures');

-- Seed default sales data (no signatures yet)
INSERT INTO public.sales (name, jabatan, active) VALUES
  ('Imam Solikhin', 'Sales', true),
  ('Firman', 'Sales', true),
  ('Dewo', 'Sales', true),
  ('Arif', 'Sales', true),
  ('Jihad', 'Sales', true),
  ('Izzu', 'Sales', true);
