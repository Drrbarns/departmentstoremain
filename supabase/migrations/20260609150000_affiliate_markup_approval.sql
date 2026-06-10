-- ============================================================================
-- PER-PRODUCT MARKUP APPROVAL
-- ============================================================================
-- Per-product custom prices now require admin approval before they affect
-- storefront pricing or commission. New/edited overrides land as 'pending';
-- only 'approved' rows are honoured. Existing rows are grandfathered to
-- 'approved' so current behaviour is preserved. Additive migration.
-- ============================================================================

ALTER TABLE public.affiliate_product_markups
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected'));

-- Grandfather everything that already existed (it was live before approval).
UPDATE public.affiliate_product_markups SET status = 'approved' WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_affiliate_product_markups_status
  ON public.affiliate_product_markups (status);
