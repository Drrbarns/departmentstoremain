-- =========================================================================
-- Master on/off switch for the storefront sale campaign
-- -------------------------------------------------------------------------
-- Lets an admin pause/resume ALL sales at once without losing the per-product
-- configuration. Implemented as a physical price swap so the rest of the app
-- (checkout, payment routes, storefront display) needs no changes — `price`
-- always remains the charged price.
--
--   pause_all_sales():  for every on-sale product/variant that is actually
--     discounted (compare_at_price > price), stash the sale price in
--     metadata.paused_sale_price, restore the regular price (price = compare),
--     and clear compare_at_price. Storefront then shows normal prices with no
--     discount badge.
--   resume_all_sales(): swap back exactly from metadata.paused_sale_price.
--
-- Both are idempotent (re-running is a no-op) and reversible. `on_sale` stays
-- true the whole time so we remember which products belong to the campaign.
-- The /sale page and the admin Sales toggle read site_settings.sales_active.
-- =========================================================================

create or replace function public.pause_all_sales()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_products int := 0; v_variants int := 0;
begin
  update product_variants v
  set metadata = coalesce(v.metadata, '{}'::jsonb) || jsonb_build_object('paused_sale_price', v.price),
      price = v.compare_at_price,
      compare_at_price = null,
      updated_at = now()
  from products p
  where v.product_id = p.id
    and p.on_sale = true
    and v.compare_at_price is not null
    and v.compare_at_price > v.price;
  get diagnostics v_variants = row_count;

  update products p
  set metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object('paused_sale_price', p.price),
      price = p.compare_at_price,
      compare_at_price = null,
      updated_at = now()
  where p.on_sale = true
    and p.compare_at_price is not null
    and p.compare_at_price > p.price;
  get diagnostics v_products = row_count;

  return jsonb_build_object('products_paused', v_products, 'variants_paused', v_variants);
end; $$;

create or replace function public.resume_all_sales()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_products int := 0; v_variants int := 0;
begin
  update product_variants v
  set compare_at_price = v.price,
      price = (v.metadata->>'paused_sale_price')::numeric,
      metadata = v.metadata - 'paused_sale_price',
      updated_at = now()
  where v.metadata ? 'paused_sale_price';
  get diagnostics v_variants = row_count;

  update products p
  set compare_at_price = p.price,
      price = (p.metadata->>'paused_sale_price')::numeric,
      metadata = p.metadata - 'paused_sale_price',
      updated_at = now()
  where p.on_sale = true
    and p.metadata ? 'paused_sale_price';
  get diagnostics v_products = row_count;

  return jsonb_build_object('products_resumed', v_products, 'variants_resumed', v_variants);
end; $$;

revoke execute on function public.pause_all_sales() from anon, authenticated;
revoke execute on function public.resume_all_sales() from anon, authenticated;
grant execute on function public.pause_all_sales() to service_role;
grant execute on function public.resume_all_sales() to service_role;

-- Default the campaign to ON (sales currently configured/active).
insert into public.site_settings (key, value)
values ('sales_active', 'true'::jsonb)
on conflict (key) do nothing;
