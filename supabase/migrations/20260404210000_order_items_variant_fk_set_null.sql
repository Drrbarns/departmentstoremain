-- Ensure order_items.variant_id does not block variant maintenance in admin.
-- If a variant is deleted/recreated, keep historical line items and null the FK.

ALTER TABLE public.order_items
DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_variant_id_fkey
FOREIGN KEY (variant_id)
REFERENCES public.product_variants(id)
ON DELETE SET NULL;

