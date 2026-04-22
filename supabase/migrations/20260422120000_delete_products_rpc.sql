-- =========================================================================
-- Transactional product deletion RPC
-- -------------------------------------------------------------------------
-- Previously the admin UI deleted products by issuing 7 separate DELETE /
-- UPDATE statements from the browser.  If any one of them failed partway
-- through, we were left with half-gone products (variants deleted but the
-- product row still present, order_items pointing at nothing, etc.).
--
-- This RPC wraps the whole sequence in a single server-side transaction
-- so it either fully succeeds or fully rolls back.  It also returns the
-- list of image paths the caller should remove from Supabase Storage
-- after the DB rows are gone.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.delete_products_with_relations(p_ids uuid[])
RETURNS TABLE(image_urls text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_urls text[] := '{}'::text[];
BEGIN
  IF NOT public.is_admin_or_staff() THEN
    RAISE EXCEPTION 'Admin or staff access required';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    image_urls := '{}'::text[];
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT url), '{}'::text[])
  INTO v_urls
  FROM public.product_images
  WHERE product_id = ANY(p_ids);

  DELETE FROM public.cart_items        WHERE product_id = ANY(p_ids);
  DELETE FROM public.wishlist_items    WHERE product_id = ANY(p_ids);
  DELETE FROM public.reviews           WHERE product_id = ANY(p_ids);
  DELETE FROM public.product_images    WHERE product_id = ANY(p_ids);
  DELETE FROM public.product_variants  WHERE product_id = ANY(p_ids);

  -- Preserve order history by nulling the reference (order_items.product_id
  -- is ON DELETE SET NULL already, but we do this explicitly to cover
  -- installations where that FK was not yet updated).
  UPDATE public.order_items SET product_id = NULL WHERE product_id = ANY(p_ids);

  DELETE FROM public.products WHERE id = ANY(p_ids);

  image_urls := v_urls;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_products_with_relations(uuid[]) FROM anon, authenticated;
