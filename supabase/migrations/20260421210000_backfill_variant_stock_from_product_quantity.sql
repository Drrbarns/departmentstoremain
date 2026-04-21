-- =========================================================================
-- Backfill variant stock from products.quantity
-- -------------------------------------------------------------------------
-- Context
--   Historically some products tracked their total stock on
--   `products.quantity` only, and their variant rows were created with
--   quantity = 0 (classic example: the image-based variants such as the
--   silk scarf patterns).  Once the storefront/POS started enforcing stock
--   at the variant level, those products appeared out of stock even though
--   the admin could still see the product total.
--
--   This migration redistributes the "missing" stock (product.quantity
--   minus sum of variant.quantity) across the variants that currently sit
--   at 0, evenly, with any remainder placed on the oldest variant.  Variant
--   rows that already have a non-zero quantity are preserved so we do not
--   clobber distributions that were set deliberately (e.g. Ladies yoga bar,
--   Stainless steel earring, etc.).
--
--   After the top-up we also normalise products.quantity to equal the sum
--   of its variants so the two numbers stay in sync going forward.
--
--   The migration is guarded by a CASE statement so running it a second
--   time is a no-op (every row is computed from the current difference).
-- =========================================================================

BEGIN;

-- 1) Top up variants that are currently at 0 when product.quantity > sum(variants).
WITH product_sums AS (
    SELECT p.id                                              AS product_id,
           p.quantity                                        AS product_qty,
           COALESCE(SUM(v.quantity), 0)                      AS variant_sum,
           COUNT(v.id) FILTER (WHERE v.quantity = 0)         AS zero_count
    FROM   public.products p
    JOIN   public.product_variants v ON v.product_id = p.id
    GROUP BY p.id, p.quantity
),
needs_topup AS (
    SELECT product_id,
           (product_qty - variant_sum) AS missing,
           zero_count
    FROM   product_sums
    WHERE  product_qty > variant_sum
      AND  zero_count > 0
),
zero_variants_ranked AS (
    SELECT v.id,
           v.product_id,
           ROW_NUMBER() OVER (PARTITION BY v.product_id
                              ORDER BY v.created_at, v.id) AS rn,
           t.missing,
           t.zero_count,
           (t.missing / t.zero_count)                                AS per_each,
           (t.missing - (t.missing / t.zero_count) * t.zero_count)   AS remainder
    FROM   public.product_variants v
    JOIN   needs_topup t ON t.product_id = v.product_id
    WHERE  v.quantity = 0
)
UPDATE public.product_variants pv
SET    quantity   = z.per_each + CASE WHEN z.rn = 1 THEN z.remainder ELSE 0 END,
       updated_at = NOW()
FROM   zero_variants_ranked z
WHERE  pv.id = z.id
  AND  pv.quantity = 0; -- idempotency guard

-- 2) Normalise products.quantity to match the sum of its variants so the
--    admin dashboard, storefront, and stock gates all agree.
WITH sums AS (
    SELECT product_id, SUM(quantity)::int AS total
    FROM   public.product_variants
    GROUP BY product_id
)
UPDATE public.products p
SET    quantity   = s.total,
       updated_at = NOW()
FROM   sums s
WHERE  s.product_id = p.id
  AND  p.quantity   <> s.total;

COMMIT;
