-- Consolidate duplicate product_variants rows (same product_id + option1 + option2)
-- into a single SURVIVOR row per duplicate group. Stock is summed. All FK
-- references (order_items, product_images, cart_items) are repointed to the
-- survivor so no order/cart/image is orphaned.
--
-- Background: before 20260404210000_order_items_variant_fk_set_null.sql the
-- admin ProductForm did a wipe-and-recreate when editing variants. That
-- sometimes produced duplicate rows because the DELETE step failed while the
-- INSERT step succeeded. This migration cleans those up and wires a persistent
-- audit log so any future delete on products / product_variants is recorded.
--
-- Safety: A pre-change snapshot lives in public._backup_product_variants_20260421,
-- public._backup_order_items_20260421, public._backup_products_20260421,
-- public._backup_product_images_20260421, public._backup_cart_items_20260421,
-- public._backup_wishlist_items_20260421.

-- =====================================================================
-- 1. Dedupe product_variants
-- =====================================================================
do $$
begin
  create temporary table _variant_dedupe_map on commit drop as
  with ranked as (
    select id,
           product_id,
           coalesce(option1,'') as o1,
           coalesce(option2,'') as o2,
           quantity,
           created_at,
           row_number() over (
             partition by product_id, coalesce(option1,''), coalesce(option2,'')
             order by created_at asc, id asc
           ) as rn,
           first_value(id) over (
             partition by product_id, coalesce(option1,''), coalesce(option2,'')
             order by created_at asc, id asc
             rows between unbounded preceding and unbounded following
           ) as survivor_id
    from public.product_variants
  )
  select id as dupe_id, survivor_id, product_id, o1, o2, quantity, rn
  from ranked;

  -- Repoint FK references from dupes -> survivor so no data is lost.
  update public.order_items oi
     set variant_id = m.survivor_id
    from _variant_dedupe_map m
   where oi.variant_id = m.dupe_id
     and m.dupe_id <> m.survivor_id;

  update public.product_images pi
     set variant_id = m.survivor_id
    from _variant_dedupe_map m
   where pi.variant_id = m.dupe_id
     and m.dupe_id <> m.survivor_id;

  update public.cart_items ci
     set variant_id = m.survivor_id
    from _variant_dedupe_map m
   where ci.variant_id = m.dupe_id
     and m.dupe_id <> m.survivor_id;

  -- Fold duplicate stock into the survivor.
  with dup_qty as (
    select survivor_id, sum(quantity) as extra_qty
    from _variant_dedupe_map
    where dupe_id <> survivor_id
    group by survivor_id
  )
  update public.product_variants v
     set quantity = v.quantity + dq.extra_qty
    from dup_qty dq
   where v.id = dq.survivor_id;

  -- Delete non-survivors.
  delete from public.product_variants pv
    using _variant_dedupe_map m
   where pv.id = m.dupe_id
     and m.dupe_id <> m.survivor_id;
end
$$;

-- =====================================================================
-- 2. Reconnect orphan order_items to currently existing variants
-- =====================================================================
do $$
begin
  create temporary table _current_variant_labels on commit drop as
  select v.id as variant_id,
         v.product_id,
         lower(trim(concat(coalesce(v.option1,''), ' / ', coalesce(v.option2, v.option1, '')))) as label_full,
         lower(trim(coalesce(v.option1, v.name, ''))) as label_short,
         lower(trim(coalesce(v.name, ''))) as label_name
  from public.product_variants v;

  create temporary table _orphan_matches on commit drop as
  with orphans as (
    select oi.id as order_item_id,
           oi.product_id,
           lower(trim(oi.variant_name)) as vn
    from public.order_items oi
    where oi.variant_id is null
      and oi.product_id is not null
      and oi.variant_name is not null
      and oi.variant_name <> ''
  ),
  candidates as (
    select distinct o.order_item_id, lbl.variant_id
      from orphans o
      join _current_variant_labels lbl on lbl.product_id = o.product_id
       and (lbl.label_full = o.vn or lbl.label_short = o.vn or lbl.label_name = o.vn)
  )
  select order_item_id, max(variant_id::text)::uuid as variant_id
    from candidates
   group by order_item_id
  having count(*) = 1;

  update public.order_items oi
     set variant_id = om.variant_id
    from _orphan_matches om
   where oi.id = om.order_item_id
     and oi.variant_id is null;
end
$$;

-- =====================================================================
-- 3. Persistent audit log for product / variant deletes
-- =====================================================================
create table if not exists public.deleted_variants_log (
  id bigserial primary key,
  variant_id uuid not null,
  product_id uuid,
  row_snapshot jsonb not null,
  deleted_by text,
  deleted_at timestamptz not null default now()
);

create table if not exists public.deleted_products_log (
  id bigserial primary key,
  product_id uuid not null,
  row_snapshot jsonb not null,
  deleted_by text,
  deleted_at timestamptz not null default now()
);

create or replace function public._log_product_variant_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.deleted_variants_log(variant_id, product_id, row_snapshot, deleted_by)
  values (old.id, old.product_id, to_jsonb(old), coalesce(current_setting('request.jwt.claim.email', true), session_user));
  return old;
end;
$$;

create or replace function public._log_product_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.deleted_products_log(product_id, row_snapshot, deleted_by)
  values (old.id, to_jsonb(old), coalesce(current_setting('request.jwt.claim.email', true), session_user));
  return old;
end;
$$;

drop trigger if exists trg_log_product_variant_delete on public.product_variants;
create trigger trg_log_product_variant_delete
before delete on public.product_variants
for each row execute function public._log_product_variant_delete();

drop trigger if exists trg_log_product_delete on public.products;
create trigger trg_log_product_delete
before delete on public.products
for each row execute function public._log_product_delete();

alter table public.deleted_variants_log enable row level security;
alter table public.deleted_products_log enable row level security;
