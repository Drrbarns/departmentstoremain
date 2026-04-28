-- =========================================================================
-- Fix delete_products_with_relations: drop broken caller check
-- -------------------------------------------------------------------------
-- The previous version of this RPC opened with:
--
--     IF NOT public.is_admin_or_staff() THEN
--         RAISE EXCEPTION 'Admin or staff access required';
--     END IF;
--
-- which inspects auth.uid().  But this function is intentionally only
-- callable by the service_role (EXECUTE was revoked from anon /
-- authenticated in 20260422120000_delete_products_rpc.sql), and our
-- /api/admin/products/delete route invokes it via the supabaseAdmin
-- client.  Service-role calls have no auth.uid(), so is_admin_or_staff()
-- always returns false and every admin delete failed with a generic
-- "Failed to delete products" alert in the UI.
--
-- Caller authentication is already enforced one layer up by verifyAuth
-- (requireAdmin: true, requireFullStaff: true) in the API route, plus
-- the EXECUTE grant means no other role can reach this function.  The
-- internal check is dead weight that breaks the only legitimate caller,
-- so we remove it.
--
-- Same pattern as mark_order_paid / reduce_stock_on_order, which also
-- gate on the EXECUTE grant and the calling API route, not auth.uid().
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
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    image_urls := '{}'::text[];
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT url), '{}'::text[])
  INTO   v_urls
  FROM   public.product_images
  WHERE  product_id = ANY(p_ids);

  DELETE FROM public.cart_items        WHERE product_id = ANY(p_ids);
  DELETE FROM public.wishlist_items    WHERE product_id = ANY(p_ids);
  DELETE FROM public.reviews           WHERE product_id = ANY(p_ids);
  DELETE FROM public.product_images    WHERE product_id = ANY(p_ids);
  DELETE FROM public.product_variants  WHERE product_id = ANY(p_ids);

  -- Preserve order history by nulling the reference (order_items.product_id
  -- is ON DELETE SET NULL already, but we do this explicitly to cover
  -- installations where that FK was not yet updated).
  UPDATE public.order_items
  SET    product_id = NULL
  WHERE  product_id = ANY(p_ids);

  DELETE FROM public.products WHERE id = ANY(p_ids);

  image_urls := v_urls;
  RETURN NEXT;
END;
$$;

-- Re-assert the grant just in case a deploy ran out of order.
REVOKE EXECUTE ON FUNCTION public.delete_products_with_relations(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_products_with_relations(uuid[]) FROM anon, authenticated;
