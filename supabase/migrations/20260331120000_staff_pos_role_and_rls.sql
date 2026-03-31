-- ============================================================
-- staff_pos role: POS + Orders only (no catalog/CMS/settings access)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'staff_pos'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'staff_pos';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.is_staff_pos()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'staff_pos'::user_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_staff_or_pos()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin'::user_role, 'staff'::user_role, 'staff_pos'::user_role)
  );
$$;

-- Orders & POS-related tables: allow staff_pos
DROP POLICY IF EXISTS "Staff manage all orders" ON public.orders;
CREATE POLICY "Staff manage all orders" ON public.orders
  FOR ALL USING (public.is_admin_staff_or_pos()) WITH CHECK (public.is_admin_staff_or_pos());

DROP POLICY IF EXISTS "Staff manage order items" ON public.order_items;
CREATE POLICY "Staff manage order items" ON public.order_items
  FOR ALL USING (public.is_admin_staff_or_pos()) WITH CHECK (public.is_admin_staff_or_pos());

DROP POLICY IF EXISTS "Staff manage order history" ON public.order_status_history;
CREATE POLICY "Staff manage order history" ON public.order_status_history
  FOR ALL USING (public.is_admin_staff_or_pos()) WITH CHECK (public.is_admin_staff_or_pos());

DROP POLICY IF EXISTS "Staff can view all customers" ON public.customers;
CREATE POLICY "Staff can view all customers" ON public.customers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role IN ('admin'::user_role, 'staff'::user_role, 'staff_pos'::user_role)
  ));

DROP POLICY IF EXISTS "Staff can manage customers" ON public.customers;
CREATE POLICY "Staff can manage customers" ON public.customers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role IN ('admin'::user_role, 'staff'::user_role, 'staff_pos'::user_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role IN ('admin'::user_role, 'staff'::user_role, 'staff_pos'::user_role)
  ));
