-- =========================================================================
-- Enforce uniqueness at the database level for product barcode + POS code
-- -------------------------------------------------------------------------
-- Previously the admin form checked "is this pos_code in use?" on the
-- client, which is a race and can be bypassed by direct DB writes.
--
-- We use partial UNIQUE indexes so NULLs and empty strings don't collide.
-- =========================================================================

-- Barcode — skip NULLs and blanks.
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique_idx
  ON public.products ((NULLIF(btrim(barcode), '')))
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '';

-- POS code lives in products.metadata->>'pos_code'.
CREATE UNIQUE INDEX IF NOT EXISTS products_pos_code_unique_idx
  ON public.products ((NULLIF(btrim(metadata->>'pos_code'), '')))
  WHERE metadata ? 'pos_code' AND btrim(metadata->>'pos_code') <> '';
