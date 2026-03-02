-- Restore missing policies for SPH and design_items and harden has_role helper

-- Ensure helper function exists with text role parameter to match current schema
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- DESIGN ITEMS POLICIES
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view design items" ON public.design_items;
  DROP POLICY IF EXISTS "Admins can insert design items" ON public.design_items;
  DROP POLICY IF EXISTS "Admins can update design items" ON public.design_items;
  DROP POLICY IF EXISTS "Admins can delete design items" ON public.design_items;
END $$;

CREATE POLICY "Authenticated users can view design items" ON public.design_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert design items" ON public.design_items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update design items" ON public.design_items
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete design items" ON public.design_items
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- SPH POLICIES
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own SPH" ON public.sph;
  DROP POLICY IF EXISTS "Users can insert own SPH" ON public.sph;
  DROP POLICY IF EXISTS "Users can update own SPH" ON public.sph;
  DROP POLICY IF EXISTS "Users can delete own SPH" ON public.sph;
  DROP POLICY IF EXISTS "Admins can view all SPH" ON public.sph;
END $$;

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

CREATE POLICY "Admins can delete SPH" ON public.sph
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
