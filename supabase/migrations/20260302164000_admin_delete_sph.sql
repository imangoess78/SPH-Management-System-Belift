DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sph'
      AND policyname = 'Admins can delete SPH'
  ) THEN
    CREATE POLICY "Admins can delete SPH" ON public.sph
      FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
