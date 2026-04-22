-- =========================================================================
-- Fix variant stock decrement + reconcile drifted products
-- -------------------------------------------------------------------------
-- Context
--   mark_order_paid and reduce_stock_on_order were decrementing
--   product_variants.quantity by matching on variant_name = pv.name.  In
--   practice the admin stores compound labels like "Default / Default" or
--   "Pink / Pink" in order_items.variant_name while product_variants.name
--   holds the raw option1 string, so the match almost always fails.
--
--   The result: for variant products the product-level quantity decreased
--   after every sale but the variant rows stayed untouched, leaving
--   products.quantity and SUM(variants.quantity) out of sync.  As of
--   today 35 products had drifted.
--
--   Fix: join on order_items.variant_id = product_variants.id (the correct
--   unambiguous key) with a name-based fallback for legacy order rows
--   that pre-date variant_id tracking.  Afterwards we re-sync
--   products.quantity to SUM(variants.quantity) for every affected
--   product so the two views always agree.
--
--   Also reconciles the 35 currently-drifted products so historical data
--   matches going forward.
-- =========================================================================

BEGIN;

-- Rewrite mark_order_paid with the correct stock decrement logic.
CREATE OR REPLACE FUNCTION public.mark_order_paid(order_ref text, moolre_ref text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_order orders;
BEGIN
  UPDATE orders
  SET payment_status = 'paid',
      status = CASE
        WHEN status = 'pending'          THEN 'processing'::order_status
        WHEN status = 'awaiting_payment' THEN 'processing'::order_status
        ELSE status
      END,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'moolre_reference',     moolre_ref,
        'payment_verified_at',  to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
  WHERE order_number = order_ref
  RETURNING * INTO updated_order;

  IF updated_order.id IS NOT NULL AND (updated_order.metadata->>'stock_reduced') IS NULL THEN
    -- 1. Decrement variant rows keyed by variant_id (the correct, unambiguous key).
    UPDATE product_variants pv
    SET    quantity   = GREATEST(0, pv.quantity - oi.quantity),
           updated_at = NOW()
    FROM   order_items oi
    WHERE  oi.order_id   = updated_order.id
      AND  oi.variant_id IS NOT NULL
      AND  oi.variant_id = pv.id;

    -- 2. Legacy fallback: for order rows without variant_id but whose product
    --    has variants, try the old name-based match so historical orders
    --    still subtract from their variant row.
    UPDATE product_variants pv
    SET    quantity   = GREATEST(0, pv.quantity - oi.quantity),
           updated_at = NOW()
    FROM   order_items oi
    WHERE  oi.order_id    = updated_order.id
      AND  oi.variant_id IS NULL
      AND  oi.product_id  = pv.product_id
      AND  oi.variant_name IS NOT NULL
      AND  oi.variant_name = pv.name;

    -- 3. Decrement products.quantity ONLY when the product has no variants
    --    at all.  For variant products we re-sync from the variants table
    --    below, which guarantees the two views agree.
    UPDATE products p
    SET    quantity   = GREATEST(0, p.quantity - oi.quantity),
           updated_at = NOW()
    FROM   order_items oi
    WHERE  oi.order_id   = updated_order.id
      AND  oi.product_id = p.id
      AND  NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id);

    -- 4. Re-sync products.quantity = SUM(variants.quantity) for every
    --    product touched by this order that has variants.
    UPDATE products p
    SET    quantity   = s.total,
           updated_at = NOW()
    FROM (
      SELECT v.product_id, COALESCE(SUM(v.quantity), 0)::int AS total
      FROM   product_variants v
      WHERE  v.product_id IN (
        SELECT DISTINCT oi.product_id
        FROM   order_items oi
        WHERE  oi.order_id = updated_order.id
          AND  oi.product_id IS NOT NULL
      )
      GROUP BY v.product_id
    ) s
    WHERE p.id = s.product_id
      AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id);

    UPDATE orders
    SET    metadata = COALESCE(metadata, '{}'::jsonb) || '{"stock_reduced": true}'::jsonb
    WHERE  id = updated_order.id;
  END IF;

  RETURN to_jsonb(updated_order);
END;
$$;

-- Mirror the same logic in reduce_stock_on_order so any direct caller is
-- consistent with mark_order_paid.
CREATE OR REPLACE FUNCTION public.reduce_stock_on_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE product_variants pv
  SET    quantity   = GREATEST(0, pv.quantity - oi.quantity),
         updated_at = NOW()
  FROM   order_items oi
  WHERE  oi.order_id   = p_order_id
    AND  oi.variant_id IS NOT NULL
    AND  oi.variant_id = pv.id;

  UPDATE product_variants pv
  SET    quantity   = GREATEST(0, pv.quantity - oi.quantity),
         updated_at = NOW()
  FROM   order_items oi
  WHERE  oi.order_id    = p_order_id
    AND  oi.variant_id IS NULL
    AND  oi.product_id  = pv.product_id
    AND  oi.variant_name IS NOT NULL
    AND  oi.variant_name = pv.name;

  UPDATE products p
  SET    quantity   = GREATEST(0, p.quantity - oi.quantity),
         updated_at = NOW()
  FROM   order_items oi
  WHERE  oi.order_id   = p_order_id
    AND  oi.product_id = p.id
    AND  NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id);

  UPDATE products p
  SET    quantity   = s.total,
         updated_at = NOW()
  FROM (
    SELECT v.product_id, COALESCE(SUM(v.quantity), 0)::int AS total
    FROM   product_variants v
    WHERE  v.product_id IN (
      SELECT DISTINCT oi.product_id FROM order_items oi
      WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
    )
    GROUP BY v.product_id
  ) s
  WHERE p.id = s.product_id
    AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id);
END;
$$;

-- One-time reconcile of the currently-drifted products.  For every product
-- that has variants, set products.quantity = SUM(variants.quantity).
UPDATE public.products p
SET    quantity   = s.total,
       updated_at = NOW()
FROM (
    SELECT product_id, COALESCE(SUM(quantity), 0)::int AS total
    FROM   public.product_variants
    GROUP BY product_id
) s
WHERE p.id = s.product_id
  AND p.quantity <> s.total;

COMMIT;
