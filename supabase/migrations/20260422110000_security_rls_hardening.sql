-- =========================================================================
-- Security hardening: RLS tightening, role escalation block, storage policies
-- -------------------------------------------------------------------------
-- 1. Drop the permissive "Enable select for guest orders" policy — any
--    anon/authenticated user could read every guest order's PII.
-- 2. Add a trigger that blocks customers from escalating their own role
--    through a profile self-update.
-- 3. Replace the open store_modules UPDATE policy with a staff-only one.
-- 4. Tighten storage bucket policies for `products` and `media` so only
--    admin/staff (not any logged-in customer) can upload/update/delete.
-- 5. Revoke public EXECUTE on mark_order_paid and friends; they should
--    only be called with the service role from server routes.
-- =========================================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. Orders: drop the permissive guest SELECT policy
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Enable select for guest orders" ON public.orders;

-- Also drop the equally-permissive "Allow bot to insert" — order creation
-- should happen via our server route (service role) with a re-priced total.
DROP POLICY IF EXISTS "Allow bot to insert" ON public.orders;

-- ---------------------------------------------------------------
-- 2. Block role escalation on profiles
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._profiles_block_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_role text;
BEGIN
  -- If the role column did not change, allow the update unchanged.
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Find the caller's effective role.  SECURITY DEFINER means we're running
  -- as the owner; we still want to know who initiated the update.
  SELECT role::text INTO caller_role FROM public.profiles WHERE id = auth.uid();

  -- Only admin/staff can change a profile's role.
  IF caller_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Only admin or staff can change profile.role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_block_role_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_block_role_escalation
BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public._profiles_block_role_escalation();

-- ---------------------------------------------------------------
-- 3. store_modules: only admin/staff can update
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated update" ON public.store_modules;

CREATE POLICY "Staff can update store_modules"
  ON public.store_modules
  FOR UPDATE
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

-- ---------------------------------------------------------------
-- 4. Storage buckets: staff-only write for `products` and `media`
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated upload to products" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update products"    ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from products" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload to media"    ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update media"       ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from media"  ON storage.objects;

CREATE POLICY "Staff can upload to products" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products' AND public.is_admin_or_staff());

CREATE POLICY "Staff can update products" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'products' AND public.is_admin_or_staff())
  WITH CHECK (bucket_id = 'products' AND public.is_admin_or_staff());

CREATE POLICY "Staff can delete from products" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'products' AND public.is_admin_or_staff());

CREATE POLICY "Staff can upload to media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.is_admin_or_staff());

CREATE POLICY "Staff can update media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.is_admin_or_staff())
  WITH CHECK (bucket_id = 'media' AND public.is_admin_or_staff());

CREATE POLICY "Staff can delete from media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.is_admin_or_staff());

-- ---------------------------------------------------------------
-- 5. RPC grants: lock down privileged functions
-- ---------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.mark_order_paid(text, text)        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reduce_stock_on_order(uuid)        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_customer_stats(text, numeric) FROM anon, authenticated;

-- Service role retains full access by default (Supabase grants it implicitly).

COMMIT;
