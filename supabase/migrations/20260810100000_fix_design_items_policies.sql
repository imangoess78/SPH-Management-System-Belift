-- ============================================================
-- Fix design_items policies: drop all old conflicting policies
-- and recreate cleanly. Both admin AND staff can manage items.
-- SELECT is open to all authenticated users.
-- ============================================================

-- Drop all existing design_items policies (idempotent)
DO $$
DECLARE
  pol TEXT;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'design_items' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.design_items', pol);
  END LOOP;
END $$;

-- SELECT: any authenticated user can read design items
CREATE POLICY "design_items_select"
  ON public.design_items FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: admin or staff
CREATE POLICY "design_items_insert"
  ON public.design_items FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
  );

-- UPDATE: admin or staff
CREATE POLICY "design_items_update"
  ON public.design_items FOR UPDATE
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
CREATE POLICY "design_items_delete"
  ON public.design_items FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
  );

-- ============================================================
-- Fix storage.objects policies for design-images bucket
-- Drop old ones and recreate to avoid conflicts
-- ============================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Anyone can view design images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload design images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete design images" ON storage.objects;
  DROP POLICY IF EXISTS "design_images_select" ON storage.objects;
  DROP POLICY IF EXISTS "design_images_insert" ON storage.objects;
  DROP POLICY IF EXISTS "design_images_update" ON storage.objects;
  DROP POLICY IF EXISTS "design_images_delete" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Anyone (including anon) can VIEW images — needed for public img tags
CREATE POLICY "design_images_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'design-images');

-- Authenticated users can UPLOAD
CREATE POLICY "design_images_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'design-images');

-- Authenticated users can UPDATE (replace)
CREATE POLICY "design_images_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'design-images');

-- Authenticated users can DELETE
CREATE POLICY "design_images_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'design-images');
