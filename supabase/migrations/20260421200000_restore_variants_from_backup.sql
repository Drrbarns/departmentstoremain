-- Restore product_variants, product_images, order_items and cart_items to the
-- state captured in _backup_*_20260421. The earlier dedupe in
-- 20260421120000_dedupe_variants_and_delete_audit_log.sql partitioned only on
-- (product_id, option1, option2) which collapsed legitimate image-based
-- variants (silk scarf patterns, earring designs, school bag prints, kids
-- towels, bathroom mats, etc.) where the admin used the image as the
-- differentiator while leaving the size/color label as "Default". 193 real
-- variants across 39 products were collapsed this way.
--
-- This migration reverses the dedupe by rehydrating every deleted row from
-- the snapshot tables, reverting quantities, and restoring every FK pointer
-- on product_images, order_items and cart_items.
--
-- Safe to run multiple times: it only changes rows where the current value
-- differs from the snapshot.

-- 1) Reinsert deleted variant rows (preserving their original UUIDs).
insert into public.product_variants (id, product_id, name, sku, price, quantity, option1, option2, image_url, metadata, created_at, updated_at)
select b.id, b.product_id, b.name, b.sku, b.price, b.quantity, b.option1, b.option2, b.image_url, b.metadata, b.created_at, b.updated_at
  from public._backup_product_variants_20260421 b
 where not exists (select 1 from public.product_variants v where v.id = b.id);

-- 2) Revert surviving variants' quantity to the pre-dedupe value (undo stock fold).
update public.product_variants v
   set quantity = b.quantity
  from public._backup_product_variants_20260421 b
 where v.id = b.id
   and v.quantity <> b.quantity;

-- 3) Revert product_images.variant_id pointers.
update public.product_images pi
   set variant_id = b.variant_id
  from public._backup_product_images_20260421 b
 where pi.id = b.id
   and pi.variant_id is distinct from b.variant_id;

-- 4) Revert order_items.variant_id pointers.
update public.order_items oi
   set variant_id = b.variant_id
  from public._backup_order_items_20260421 b
 where oi.id = b.id
   and oi.variant_id is distinct from b.variant_id;

-- 5) Revert cart_items.variant_id pointers.
update public.cart_items ci
   set variant_id = b.variant_id
  from public._backup_cart_items_20260421 b
 where ci.id = b.id
   and ci.variant_id is distinct from b.variant_id;
