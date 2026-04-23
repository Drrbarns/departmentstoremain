-- =========================================================================
-- Fix: Restore client-side INSERT policy on public.orders
-- -------------------------------------------------------------------------
-- The security hardening migration (20260422110000) dropped "Allow bot to
-- insert" on public.orders, assuming checkout would be moved to a server
-- route. It wasn't — app/(store)/checkout/page.tsx still creates the order
-- row directly from the browser with the anon/authenticated key.  As a
-- result every customer (guest or signed-in) now hits
--   "new row violates row-level security policy for table \"orders\""
-- and can't place an order.
--
-- We restore INSERT but scope it so:
--   * The inserted row must be payment_status = 'pending' (server later
--     flips it via mark_order_paid() which runs as service_role).
--   * Signed-in users can only create orders for themselves (user_id =
--     auth.uid()) or as a true guest (user_id IS NULL).
--   * Anonymous visitors can only create guest orders (user_id IS NULL).
--
-- The authoritative total/price is still recomputed server-side by
-- /api/payment/moolre before the customer is ever charged, so a tampered
-- client total cannot actually lead to a mispriced payment.
-- =========================================================================

BEGIN;

DROP POLICY IF EXISTS "Customers can create their own orders" ON public.orders;

CREATE POLICY "Customers can create their own orders"
  ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- New orders must start unpaid; mark_order_paid (service_role) flips it.
    COALESCE(payment_status, 'pending') = 'pending'
    AND (
      -- Guest checkout: no user attached.
      user_id IS NULL
      -- Or a signed-in customer placing an order for themselves.
      OR user_id = auth.uid()
    )
  );

COMMIT;
