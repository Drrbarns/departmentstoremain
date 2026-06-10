-- ============================================================================
-- AFFILIATE PER-PRODUCT MARKUPS + MAX-MARKUP CAP
-- ============================================================================
-- Lets affiliates set their own default markup AND override it per product
-- (either as a percentage or an absolute selling price, which is converted to
-- an equivalent percentage so the pricing/commission engine stays uniform and
-- variant-safe). Admin caps the maximum markup via site_settings.
-- Additive migration — no existing objects are modified.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.affiliate_product_markups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- How the affiliate expressed the override in the UI ('pct' | 'price').
  markup_type text NOT NULL DEFAULT 'pct' CHECK (markup_type IN ('pct', 'price')),
  -- Effective markup percent — the source of truth used for all math.
  markup_pct numeric NOT NULL DEFAULT 0 CHECK (markup_pct >= 0 AND markup_pct <= 100),
  -- Original fixed price entered when markup_type='price' (for redisplay only).
  fixed_price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_affiliate_product UNIQUE (affiliate_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_product_markups_affiliate
  ON public.affiliate_product_markups (affiliate_id);

DO $$ BEGIN
  CREATE TRIGGER set_affiliate_product_markups_updated_at
    BEFORE UPDATE ON public.affiliate_product_markups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.affiliate_product_markups ENABLE ROW LEVEL SECURITY;

-- Affiliate manages their own overrides; admin/staff manage all. Storefront
-- reads for an attributed (non-owner) visitor happen via the service role.
CREATE POLICY "affiliate_product_markups_select_own" ON public.affiliate_product_markups
  FOR SELECT USING (
    is_admin_or_staff() OR
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
  );
CREATE POLICY "affiliate_product_markups_modify_own" ON public.affiliate_product_markups
  FOR ALL USING (
    is_admin_or_staff() OR
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
  ) WITH CHECK (
    is_admin_or_staff() OR
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
  );

-- Add the max-markup cap to the affiliate settings JSON (default 50%).
UPDATE public.site_settings
SET value = value || jsonb_build_object('max_commission_pct', 50)
WHERE key = 'affiliate'
  AND NOT (value ? 'max_commission_pct');
