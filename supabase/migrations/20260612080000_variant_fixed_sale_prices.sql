-- =========================================================================
-- Per-variant fixed sale prices
-- -------------------------------------------------------------------------
-- apply_sale_fixed() deliberately excludes variant products because a single
-- fixed price rarely fits every variant. This RPC fills that gap: it takes a
-- list of {variant_id, price} pairs and puts each variant on sale at its own
-- custom price.
--
-- Per variant:  compare_at_price = current regular price (derived from the
--               current state, so re-applying never compounds), price = the
--               given sale price. Skipped silently when the given price is
--               not strictly below the variant's regular price.
-- Per product:  on_sale = true, compare_at_price = regular price, and price
--               mirrors the cheapest charged variant price so the storefront
--               "From GH₵X" + discount badge stay correct.
--
-- Works with the existing campaign machinery: remove_sale() reverts these,
-- and pause_all_sales()/resume_all_sales() stash/restore them.
-- =========================================================================

create or replace function public.apply_sale_variant_prices(p_items jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_variants int := 0; v_products int := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'p_items must be a non-empty json array of {variant_id, price}';
  end if;

  update product_variants v
  set compare_at_price = case when v.compare_at_price is not null and v.compare_at_price > v.price
                              then v.compare_at_price else v.price end,
      price = i.sale_price,
      updated_at = now()
  from (
    select (e->>'variant_id')::uuid as id, (e->>'price')::numeric as sale_price
    from jsonb_array_elements(p_items) e
  ) i
  where v.id = i.id
    and i.sale_price is not null
    and i.sale_price > 0
    and i.sale_price < (case when v.compare_at_price is not null and v.compare_at_price > v.price
                             then v.compare_at_price else v.price end);
  get diagnostics v_variants = row_count;

  update products p
  set on_sale = true,
      compare_at_price = case when p.on_sale and p.compare_at_price is not null and p.compare_at_price > p.price
                              then p.compare_at_price else p.price end,
      price = s.min_price,
      updated_at = now()
  from (
    select v.product_id, min(v.price) as min_price
    from product_variants v
    where v.product_id in (
      select v2.product_id from product_variants v2
      where v2.id in (select (e->>'variant_id')::uuid from jsonb_array_elements(p_items) e)
    )
    group by v.product_id
  ) s
  where p.id = s.product_id
    and exists (
      select 1 from product_variants v3
      where v3.product_id = p.id
        and v3.compare_at_price is not null
        and v3.compare_at_price > v3.price
    );
  get diagnostics v_products = row_count;

  return jsonb_build_object('variants_updated', v_variants, 'products_updated', v_products);
end; $$;

revoke execute on function public.apply_sale_variant_prices(jsonb) from anon, authenticated;
grant execute on function public.apply_sale_variant_prices(jsonb) to service_role;
