-- =========================================================================
-- Add an explicit `on_sale` flag to products
-- -------------------------------------------------------------------------
-- Context
--   The storefront already models a sale as `compare_at_price > price`
--   (price = what the customer pays, compare_at_price = the struck-through
--   "was" price). That works for display + checkout, but PostgREST can't
--   filter one column against another, so there was no efficient way to
--   list "the products we put on sale" for a dedicated /sale page or an
--   admin Sales manager.
--
--   This adds a boolean `on_sale` flag that the new admin Sales tool toggles
--   alongside the price/compare_at_price changes. It is purely additive and
--   does NOT change how money is charged: the payment routes still charge
--   `products.price` (and `product_variants.price`), which the Sales tool
--   sets to the discounted amount. compare_at_price holds the regular price
--   while a product is on sale so the discount can be reverted cleanly.
--
--   Backfill: every product that already has compare_at_price > price is
--   flagged on_sale so existing discounted items immediately appear on the
--   Sales page. Admins can remove any they don't want via the admin tool.
-- =========================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS on_sale boolean NOT NULL DEFAULT false;

-- Partial index keeps the /sale listing query fast without bloating writes
-- for the (majority) non-sale rows.
CREATE INDEX IF NOT EXISTS idx_products_on_sale
  ON public.products (on_sale)
  WHERE on_sale = true;

UPDATE public.products
  SET on_sale = true
  WHERE compare_at_price IS NOT NULL
    AND compare_at_price > price
    AND on_sale = false;
