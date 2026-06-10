-- ============================================================================
-- AFFILIATE SYSTEM
-- ============================================================================
-- Markup-on-top model: a customer arriving via an affiliate link pays
-- base_price * (1 + commission_pct/100). The business keeps the base amount;
-- the markup is the affiliate's commission. Commissions accrue to a ledger
-- on confirmed payment, mature after a hold window, then are paid out
-- (manually to start, automatically via Moolre later).
-- All amounts are GHS. Additive migration — no existing objects are modified.
-- ============================================================================

-- ─── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE affiliate_status AS ENUM ('pending', 'active', 'suspended', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE affiliate_commission_status AS ENUM ('pending', 'matured', 'paid', 'clawed_back', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE affiliate_payout_status AS ENUM ('pending', 'processing', 'paid', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Affiliates ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  status affiliate_status NOT NULL DEFAULT 'pending',
  -- Admin-controlled commission percentage applied as the customer-facing markup.
  commission_pct numeric NOT NULL DEFAULT 10 CHECK (commission_pct >= 0 AND commission_pct <= 100),
  full_name text,
  email text,
  phone text,
  -- Payout destination (mobile money to start).
  payout_method text DEFAULT 'momo',
  payout_number text,
  payout_provider text,            -- MTN / Vodafone / AirtelTigo
  payout_name text,
  -- Running balances (kept in sync by the app when ledger rows change).
  total_earned numeric NOT NULL DEFAULT 0,   -- lifetime commissions that matured
  total_paid numeric NOT NULL DEFAULT 0,     -- lifetime paid out
  balance_pending numeric NOT NULL DEFAULT 0,-- commissions not yet matured
  balance_available numeric NOT NULL DEFAULT 0, -- matured, not yet paid
  notes text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_code ON public.affiliates (code);
CREATE INDEX IF NOT EXISTS idx_affiliates_user ON public.affiliates (user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON public.affiliates (status);

-- ─── Click tracking ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  code text NOT NULL,
  landing_path text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ip_hash text,
  user_agent text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate ON public.affiliate_clicks (affiliate_id, created_at DESC);

-- ─── Commission ledger ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number text NOT NULL,
  base_amount numeric NOT NULL,          -- product subtotal the % was applied to
  commission_pct numeric NOT NULL,
  commission_amount numeric NOT NULL,    -- = markup the customer paid
  status affiliate_commission_status NOT NULL DEFAULT 'pending',
  matures_at timestamptz,                -- when it becomes payable
  payout_id uuid,                        -- set when included in a payout
  matured_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- one commission per order
  CONSTRAINT uq_affiliate_commissions_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate ON public.affiliate_commissions (affiliate_id, status);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON public.affiliate_commissions (status, matures_at);

-- ─── Payouts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method text DEFAULT 'momo',
  destination text,                      -- momo number paid to
  provider text,
  status affiliate_payout_status NOT NULL DEFAULT 'pending',
  moolre_ref text,
  failure_reason text,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate ON public.affiliate_payouts (affiliate_id, status);

-- FK from commissions to payouts (added after payouts table exists)
DO $$ BEGIN
  ALTER TABLE public.affiliate_commissions
    ADD CONSTRAINT fk_affiliate_commissions_payout
    FOREIGN KEY (payout_id) REFERENCES public.affiliate_payouts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── updated_at triggers (reuse existing helper if present) ──────────────────
DO $$ BEGIN
  CREATE TRIGGER set_affiliates_updated_at BEFORE UPDATE ON public.affiliates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_affiliate_commissions_updated_at BEFORE UPDATE ON public.affiliate_commissions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- ─── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Affiliates: a user manages their own row; admin/staff manage all.
CREATE POLICY "affiliates_select_own" ON public.affiliates
  FOR SELECT USING (user_id = auth.uid() OR is_admin_or_staff());
CREATE POLICY "affiliates_insert_self" ON public.affiliates
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "affiliates_update_admin" ON public.affiliates
  FOR UPDATE USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());
CREATE POLICY "affiliates_admin_all" ON public.affiliates
  FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- Clicks: admin read; inserts happen server-side via service role (bypasses RLS).
CREATE POLICY "affiliate_clicks_admin" ON public.affiliate_clicks
  FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- Commissions: affiliate sees their own; admin manages all. Writes via service role.
CREATE POLICY "affiliate_commissions_select_own" ON public.affiliate_commissions
  FOR SELECT USING (
    is_admin_or_staff() OR
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
  );
CREATE POLICY "affiliate_commissions_admin" ON public.affiliate_commissions
  FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- Payouts: affiliate sees their own; admin manages all.
CREATE POLICY "affiliate_payouts_select_own" ON public.affiliate_payouts
  FOR SELECT USING (
    is_admin_or_staff() OR
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
  );
CREATE POLICY "affiliate_payouts_admin" ON public.affiliate_payouts
  FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ─── Default settings ────────────────────────────────────────────────────────
INSERT INTO public.site_settings (key, value, category)
VALUES (
  'affiliate',
  jsonb_build_object(
    'enabled', true,
    'default_commission_pct', 10,
    'max_commission_pct', 50,
    'attribution_days', 30,
    'maturity_days', 7,
    'min_payout', 0,
    'cookie_name', 'dds_ref',
    'auto_disburse', false
  ),
  'affiliate'
)
ON CONFLICT (key) DO NOTHING;
