-- =========================================================================
-- Orders RLS: final state
-- -------------------------------------------------------------------------
-- Guest / anonymous checkout now goes through the Next.js server route
--   POST /api/storefront/orders/create
-- which uses the service role to insert the order + items.  Therefore the
-- anon role no longer needs INSERT or SELECT on public.orders at all —
-- which also closes the earlier PII-enumeration hole where any anon user
-- could SELECT every guest order in the database.
--
-- Why couldn't we just add an anon INSERT policy?
-- ------------------------------------------------
-- The browser client calls `supabase.from('orders').insert([...]).select()`,
-- which sends `Prefer: return=representation`.  Postgres requires the
-- inserted row to ALSO satisfy a SELECT policy for the caller so that the
-- RETURNING clause can read it back.  With guest SELECT removed (for PII
-- safety) no such policy exists for anon, so the insert is rejected with
-- "new row violates row-level security policy for table \"orders\"" even
-- when the INSERT WITH CHECK is `true`.  Routing through a service-role
-- server handler is the clean fix.
-- =========================================================================

BEGIN;

DROP POLICY IF EXISTS "Customers can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Enable insert for all users"            ON public.orders;
DROP POLICY IF EXISTS "Staff manage all orders"                ON public.orders;
DROP POLICY IF EXISTS "Users view own orders"                  ON public.orders;
DROP POLICY IF EXISTS "_test_insert"                           ON public.orders;
DROP POLICY IF EXISTS "only_check"                             ON public.orders;
DROP POLICY IF EXISTS "_rls_unconditional_allow"               ON public.orders;
DROP POLICY IF EXISTS "tmp_allow_all"                          ON public.orders;

-- Authenticated users may insert their own orders directly (the signed-in
-- checkout path still works via the supabase JS client, because an
-- authenticated user satisfies both the INSERT WITH CHECK and the
-- SELECT USING policy below, so RETURNING succeeds).
CREATE POLICY "Authenticated users insert own orders"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE(payment_status, 'pending'::payment_status) = 'pending'::payment_status
    AND (user_id = auth.uid())
  );

-- Signed-in users can read their own orders.
CREATE POLICY "Users view own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin / staff / POS full control.
CREATE POLICY "Staff manage all orders"
  ON public.orders
  FOR ALL
  USING (is_admin_staff_or_pos())
  WITH CHECK (is_admin_staff_or_pos());

COMMIT;
