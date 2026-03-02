-- Allow staff to view all SPH (read-only), keep existing owner and admin access

DO $$
BEGIN
  -- remove existing select policies to avoid duplicates
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sph' AND policyname='Users can view own SPH') THEN
    DROP POLICY "Users can view own SPH" ON public.sph;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sph' AND policyname='Admins can view all SPH') THEN
    DROP POLICY "Admins can view all SPH" ON public.sph;
  END IF;
END $$;

CREATE POLICY "SPH readable by owner/admin/staff" ON public.sph
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
  );
