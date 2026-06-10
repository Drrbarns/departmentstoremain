-- ============================================================================
-- AFFILIATE COMMISSION-RATE REQUEST (admin approval workflow)
-- ============================================================================
-- Affiliates can propose a new general commission %, which stays pending until
-- an admin approves it. `commission_pct` remains the active/approved rate;
-- `pending_commission_pct` holds the requested value while it awaits approval.
-- Additive migration.
-- ============================================================================

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS pending_commission_pct numeric
    CHECK (pending_commission_pct IS NULL OR (pending_commission_pct >= 0 AND pending_commission_pct <= 100));

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS commission_requested_at timestamptz;
