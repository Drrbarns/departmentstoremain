-- =========================================================================
-- Sale management RPCs
-- -------------------------------------------------------------------------
-- Used by the admin Sales tool (/api/admin/sales). All three compute the
-- "regular" (pre-sale) price from the OLD row values, which gives two
-- properties for free:
--   * Re-applying a discount never compounds (e.g. 20% then 30% both derive
--     from the same regular price, not from the already-discounted price).
--   * remove_sale() can restore the original price exactly.
--
-- Pricing model (unchanged from the rest of the app):
--   price            = what the customer is charged
--   compare_at_price = the regular/"was" price (struck through on storefront)
--                      held here while the product is on sale
--   on_sale          = explicit promo flag for the /sale page + admin filter
--
-- Variants are kept in sync because checkout charges product_variants.price
-- for variant products. Variants have no on_sale column, so "already on sale"
-- is inferred from compare_at_price > price.
-- =========================================================================

create or replace function public.apply_sale_percentage(p_ids uuid[], p_pct numeric)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_products int := 0; v_variants int := 0;
begin
  if p_pct is null or p_pct <= 0 or p_pct >= 100 then
    raise exception 'Discount percent must be between 0 and 100 (got %)', p_pct;
  end if;

  update product_variants v
  set price = round((case when v.compare_at_price is not null and v.compare_at_price > v.price then v.compare_at_price else v.price end) * (1 - p_pct/100.0), 2),
      compare_at_price = (case when v.compare_at_price is not null and v.compare_at_price > v.price then v.compare_at_price else v.price end),
      updated_at = now()
  where v.product_id = any(p_ids)
    and (case when v.compare_at_price is not null and v.compare_at_price > v.price then v.compare_at_price else v.price end) > 0;
  get diagnostics v_variants = row_count;

  update products p
  set price = round((case when p.on_sale and p.compare_at_price is not null and p.compare_at_price > p.price then p.compare_at_price else p.price end) * (1 - p_pct/100.0), 2),
      compare_at_price = (case when p.on_sale and p.compare_at_price is not null and p.compare_at_price > p.price then p.compare_at_price else p.price end),
      on_sale = true,
      updated_at = now()
  where p.id = any(p_ids)
    and (case when p.on_sale and p.compare_at_price is not null and p.compare_at_price > p.price then p.compare_at_price else p.price end) > 0;
  get diagnostics v_products = row_count;

  return jsonb_build_object('products_updated', v_products, 'variants_updated', v_variants);
end; $$;

create or replace function public.apply_sale_fixed(p_ids uuid[], p_price numeric)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_products int := 0;
begin
  if p_price is null or p_price <= 0 then
    raise exception 'Sale price must be greater than 0 (got %)', p_price;
  end if;

  -- Fixed price only applies to products WITHOUT variants (a single price
  -- across differently-priced variants would be wrong, and checkout charges
  -- the variant price). Variant products should use a percentage instead.
  update products p
  set compare_at_price = (case when p.on_sale and p.compare_at_price is not null and p.compare_at_price > p.price then p.compare_at_price else p.price end),
      price = p_price,
      on_sale = true,
      updated_at = now()
  where p.id = any(p_ids)
    and not exists (select 1 from product_variants v where v.product_id = p.id)
    and p_price < (case when p.on_sale and p.compare_at_price is not null and p.compare_at_price > p.price then p.compare_at_price else p.price end);
  get diagnostics v_products = row_count;

  return jsonb_build_object('products_updated', v_products);
end; $$;

create or replace function public.remove_sale(p_ids uuid[])
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_products int := 0; v_variants int := 0;
begin
  update product_variants v
  set price = v.compare_at_price,
      compare_at_price = null,
      updated_at = now()
  where v.product_id = any(p_ids)
    and v.compare_at_price is not null
    and v.compare_at_price > v.price;
  get diagnostics v_variants = row_count;

  update products p
  set price = coalesce(p.compare_at_price, p.price),
      compare_at_price = null,
      on_sale = false,
      updated_at = now()
  where p.id = any(p_ids)
    and p.on_sale = true;
  get diagnostics v_products = row_count;

  return jsonb_build_object('products_updated', v_products, 'variants_updated', v_variants);
end; $$;

revoke execute on function public.apply_sale_percentage(uuid[], numeric) from anon, authenticated;
revoke execute on function public.apply_sale_fixed(uuid[], numeric) from anon, authenticated;
revoke execute on function public.remove_sale(uuid[]) from anon, authenticated;
grant execute on function public.apply_sale_percentage(uuid[], numeric) to service_role;
grant execute on function public.apply_sale_fixed(uuid[], numeric) to service_role;
grant execute on function public.remove_sale(uuid[]) to service_role;
