-- ============================================================
-- DISCOUNT DISCOVERY ZONE — Complete Database Schema
-- Generated from live Supabase database on 2026-03-27
--
-- This migration creates the full schema from scratch.
-- Run in the Supabase SQL Editor or via `supabase db push`.
--
-- Covers: 30 tables, 13 enum types, 11 functions,
--         16 triggers, 20 foreign keys, 68 RLS policies,
--         77+ indexes, 5 storage buckets
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================
-- 2. ENUM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'staff', 'customer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE address_type AS ENUM ('shipping', 'billing', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('active', 'draft', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE category_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'awaiting_payment', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discount_type AS ENUM ('percentage', 'fixed_amount', 'free_shipping');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE blog_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE return_status AS ENUM ('pending', 'approved', 'rejected', 'processing', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 3. UTILITY FUNCTIONS
-- ============================================================

-- Role check helper used extensively in RLS policies
CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'staff')
  );
END;
$$;

-- Auto-update updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-create profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Recalculate product rating when reviews change
CREATE OR REPLACE FUNCTION public.update_product_rating_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE products
  SET rating_avg = (
    SELECT COALESCE(AVG(rating), 0)
    FROM reviews
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    AND status = 'approved'
  ),
  review_count = (
    SELECT COUNT(*)
    FROM reviews
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    AND status = 'approved'
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Upsert customer record from checkout, deduplicating by email/phone
CREATE OR REPLACE FUNCTION public.upsert_customer_from_order(
  p_email text,
  p_phone text,
  p_full_name text,
  p_first_name text,
  p_last_name text,
  p_user_id uuid DEFAULT NULL,
  p_address jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id UUID;
  v_existing_email TEXT;
  v_existing_phone TEXT;
  v_existing_secondary_email TEXT;
  v_existing_secondary_phone TEXT;
BEGIN
  SELECT id, email, phone, secondary_email, secondary_phone
  INTO v_customer_id, v_existing_email, v_existing_phone, v_existing_secondary_email, v_existing_secondary_phone
  FROM customers
  WHERE email = p_email OR secondary_email = p_email
  LIMIT 1;

  IF v_customer_id IS NULL AND p_phone IS NOT NULL AND p_phone != '' THEN
    SELECT id, email, phone, secondary_email, secondary_phone
    INTO v_customer_id, v_existing_email, v_existing_phone, v_existing_secondary_email, v_existing_secondary_phone
    FROM customers
    WHERE phone = p_phone OR secondary_phone = p_phone
    LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    INSERT INTO customers (email, phone, full_name, first_name, last_name, user_id, default_address)
    VALUES (p_email, p_phone, p_full_name, p_first_name, p_last_name, p_user_id, p_address)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE customers SET
      secondary_email = CASE
        WHEN p_email IS NOT NULL
             AND p_email != ''
             AND p_email != v_existing_email
             AND (v_existing_secondary_email IS NULL OR v_existing_secondary_email = '' OR v_existing_secondary_email != p_email)
        THEN p_email
        ELSE secondary_email
      END,
      secondary_phone = CASE
        WHEN p_phone IS NOT NULL
             AND p_phone != ''
             AND p_phone != v_existing_phone
             AND (v_existing_secondary_phone IS NULL OR v_existing_secondary_phone = '' OR v_existing_secondary_phone != p_phone)
        THEN p_phone
        ELSE secondary_phone
      END,
      full_name = COALESCE(NULLIF(p_full_name, ''), full_name),
      first_name = COALESCE(NULLIF(p_first_name, ''), first_name),
      last_name = COALESCE(NULLIF(p_last_name, ''), last_name),
      user_id = COALESCE(p_user_id, user_id),
      default_address = COALESCE(p_address, default_address),
      updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;

  RETURN v_customer_id;
END;
$$;

-- Increment customer order count and spend after payment
CREATE OR REPLACE FUNCTION public.update_customer_stats(p_customer_email text, p_order_total numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE customers
  SET total_orders = total_orders + 1,
      total_spent = total_spent + p_order_total,
      last_order_at = NOW(),
      updated_at = NOW()
  WHERE email = p_customer_email;
END;
$$;

-- Mark order as paid, reduce stock, record payment reference
CREATE OR REPLACE FUNCTION public.mark_order_paid(order_ref text, moolre_ref text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_order orders;
BEGIN
  UPDATE orders
  SET payment_status = 'paid',
      status = CASE
        WHEN status = 'pending' THEN 'processing'::order_status
        WHEN status = 'awaiting_payment' THEN 'processing'::order_status
        ELSE status
      END,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'moolre_reference', moolre_ref,
        'payment_verified_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
  WHERE order_number = order_ref
  RETURNING * INTO updated_order;

  IF updated_order.id IS NOT NULL AND (updated_order.metadata->>'stock_reduced') IS NULL THEN
    UPDATE products p
    SET quantity = GREATEST(0, p.quantity - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = updated_order.id AND oi.product_id = p.id;

    UPDATE product_variants pv
    SET quantity = GREATEST(0, pv.quantity - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = updated_order.id
      AND oi.product_id = pv.product_id
      AND oi.variant_name IS NOT NULL
      AND oi.variant_name = pv.name;

    UPDATE orders
    SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"stock_reduced": true}'::jsonb
    WHERE id = updated_order.id;
  END IF;

  RETURN to_jsonb(updated_order);
END;
$$;

-- Standalone stock reduction (called separately if needed)
CREATE OR REPLACE FUNCTION public.reduce_stock_on_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE products p
  SET quantity = GREATEST(p.quantity - oi.quantity, 0),
      updated_at = now()
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.product_id = p.id;

  UPDATE product_variants pv
  SET quantity = GREATEST(pv.quantity - oi.quantity, 0),
      updated_at = now()
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.product_id = pv.product_id
    AND oi.variant_name IS NOT NULL
    AND oi.variant_name = pv.name;
END;
$$;

-- Get all customer emails (primary + secondary) for bulk messaging
CREATE OR REPLACE FUNCTION public.get_all_customer_emails()
RETURNS TABLE(email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT e.email
  FROM (
    SELECT c.email FROM customers c WHERE c.email IS NOT NULL AND c.email != ''
    UNION
    SELECT c.secondary_email FROM customers c WHERE c.secondary_email IS NOT NULL AND c.secondary_email != ''
  ) e
  ORDER BY e.email;
END;
$$;

-- Get all customer phones (primary + secondary) for bulk SMS
CREATE OR REPLACE FUNCTION public.get_all_customer_phones()
RETURNS TABLE(phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.phone
  FROM (
    SELECT c.phone FROM customers c WHERE c.phone IS NOT NULL AND c.phone != ''
    UNION
    SELECT c.secondary_phone FROM customers c WHERE c.secondary_phone IS NOT NULL AND c.secondary_phone != ''
  ) p
  ORDER BY p.phone;
END;
$$;

-- Auto-enable RLS on any new table created in public schema
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table', 'partitioned table')
  LOOP
    IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public')
       AND cmd.schema_name NOT IN ('pg_catalog', 'information_schema')
       AND cmd.schema_name NOT LIKE 'pg_toast%'
       AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 4. TABLES
-- ============================================================

-- User profiles (auto-created on signup via trigger)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text UNIQUE,
  role        user_role DEFAULT 'customer',
  full_name   text,
  phone       text,
  avatar_url  text,
  date_of_birth date,
  gender      gender_type,
  preferences jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Customer addresses
CREATE TABLE IF NOT EXISTS public.addresses (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type          address_type DEFAULT 'shipping',
  is_default    boolean DEFAULT false,
  label         text,
  full_name     text NOT NULL,
  phone         text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  city          text NOT NULL,
  state         text NOT NULL,
  postal_code   text NOT NULL,
  country       text NOT NULL,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Store-level settings (key-value)
CREATE TABLE IF NOT EXISTS public.store_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  updated_at  timestamptz DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id)
);

-- Admin audit trail
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id),
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  details     jsonb,
  ip_address  text,
  created_at  timestamptz DEFAULT now()
);

-- Product categories with self-referencing parent for hierarchy
CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text,
  parent_id   uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url   text,
  position    integer DEFAULT 0,
  status      category_status DEFAULT 'active',
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS public.products (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              text NOT NULL,
  slug              text UNIQUE NOT NULL,
  description       text,
  short_description text,
  price             numeric NOT NULL,
  compare_at_price  numeric,
  cost_per_item     numeric,
  sku               text UNIQUE,
  barcode           text,
  quantity          integer DEFAULT 0,
  track_quantity    boolean DEFAULT true,
  continue_selling  boolean DEFAULT false,
  weight            numeric,
  weight_unit       text DEFAULT 'kg',
  category_id       uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  brand             text,
  vendor            text,
  tags              text[],
  status            product_status DEFAULT 'active',
  featured          boolean DEFAULT false,
  options           jsonb DEFAULT '[]',
  external_id       text,
  external_source   text,
  seo_title         text,
  seo_description   text,
  rating_avg        numeric DEFAULT 0,
  review_count      integer DEFAULT 0,
  metadata          jsonb DEFAULT '{}',
  moq               integer DEFAULT 1 CHECK (moq >= 1),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Product images (can be linked to a product or a specific variant)
CREATE TABLE IF NOT EXISTS public.product_images (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  uuid REFERENCES public.products(id) ON DELETE CASCADE,
  url         text NOT NULL,
  alt_text    text,
  position    integer DEFAULT 0,
  width       integer,
  height      integer,
  variant_id  uuid,
  created_at  timestamptz DEFAULT now()
);

-- Product variants (size, color, etc.)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id       uuid REFERENCES public.products(id) ON DELETE CASCADE,
  name             text NOT NULL,
  sku              text UNIQUE,
  price            numeric NOT NULL,
  compare_at_price numeric,
  cost_per_item    numeric,
  quantity         integer DEFAULT 0,
  weight           numeric,
  option1          text,
  option2          text,
  option3          text,
  image_url        text,
  barcode          text,
  external_id      text,
  metadata         jsonb DEFAULT '{}',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Add FK for product_images.variant_id after product_variants exists
ALTER TABLE public.product_images
  DROP CONSTRAINT IF EXISTS product_images_variant_id_fkey;
ALTER TABLE public.product_images
  ADD CONSTRAINT product_images_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- Discount coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             text UNIQUE NOT NULL,
  description      text,
  type             discount_type NOT NULL,
  value            numeric NOT NULL,
  minimum_purchase numeric DEFAULT 0,
  maximum_discount numeric,
  usage_limit      integer,
  usage_count      integer DEFAULT 0,
  per_user_limit   integer DEFAULT 1,
  start_date       timestamptz,
  end_date         timestamptz,
  is_active        boolean DEFAULT true,
  metadata         jsonb DEFAULT '{}',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number             text UNIQUE NOT NULL,
  user_id                  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email                    text NOT NULL,
  phone                    text,
  status                   order_status DEFAULT 'pending',
  payment_status           payment_status DEFAULT 'pending',
  currency                 text DEFAULT 'USD',
  subtotal                 numeric NOT NULL,
  tax_total                numeric DEFAULT 0,
  shipping_total           numeric DEFAULT 0,
  discount_total           numeric DEFAULT 0,
  total                    numeric NOT NULL,
  shipping_method          text,
  payment_method           text,
  payment_provider         text,
  payment_transaction_id   text,
  notes                    text,
  cancel_reason            text,
  shipping_address         jsonb NOT NULL,
  billing_address          jsonb NOT NULL,
  metadata                 jsonb DEFAULT '{}',
  payment_reminder_sent    boolean DEFAULT false,
  payment_reminder_sent_at timestamptz,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

-- Line items within an order
CREATE TABLE IF NOT EXISTS public.order_items (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id    uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id    uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name  text NOT NULL,
  variant_name  text,
  sku           text,
  quantity      integer NOT NULL,
  unit_price    numeric NOT NULL,
  total_price   numeric NOT NULL,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

-- Status change history for orders
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  status     order_status NOT NULL,
  notes      text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Server-side cart items (for logged-in users)
CREATE TABLE IF NOT EXISTS public.cart_items (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity   integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id, variant_id)
);

-- Wishlist
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Product reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id        uuid REFERENCES public.products(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating            integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title             text,
  content           text,
  status            review_status DEFAULT 'pending',
  verified_purchase boolean DEFAULT false,
  helpful_votes     integer DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Images attached to reviews
CREATE TABLE IF NOT EXISTS public.review_images (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id  uuid REFERENCES public.reviews(id) ON DELETE CASCADE,
  url        text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Blog / content posts
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           text NOT NULL,
  slug            text UNIQUE NOT NULL,
  excerpt         text,
  content         text NOT NULL,
  featured_image  text,
  author_id       uuid REFERENCES auth.users(id),
  status          blog_status DEFAULT 'draft',
  published_at    timestamptz,
  seo_title       text,
  seo_description text,
  tags            text[],
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Support ticket sequence for human-readable ticket numbers
CREATE SEQUENCE IF NOT EXISTS support_tickets_ticket_number_seq;

-- Customer support tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number integer NOT NULL DEFAULT nextval('support_tickets_ticket_number_seq'),
  user_id       uuid REFERENCES auth.users(id),
  email         text NOT NULL,
  subject       text NOT NULL,
  description   text,
  category      text,
  status        ticket_status DEFAULT 'open',
  priority      ticket_priority DEFAULT 'medium',
  assigned_to   uuid REFERENCES auth.users(id),
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Messages within a support ticket
CREATE TABLE IF NOT EXISTS public.support_messages (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id),
  message     text NOT NULL,
  attachments jsonb DEFAULT '[]',
  is_internal boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- Return / refund requests
CREATE TABLE IF NOT EXISTS public.return_requests (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id),
  status        return_status DEFAULT 'pending',
  reason        text NOT NULL,
  description   text,
  refund_amount numeric,
  refund_method text,
  admin_notes   text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Individual items in a return request
CREATE TABLE IF NOT EXISTS public.return_items (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_request_id uuid REFERENCES public.return_requests(id) ON DELETE CASCADE,
  order_item_id     uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  quantity          integer NOT NULL,
  reason            text,
  condition         text,
  created_at        timestamptz DEFAULT now()
);

-- In-app notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  message    text,
  data       jsonb,
  read_at    timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Static pages (about, contact, etc.)
CREATE TABLE IF NOT EXISTS public.pages (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           text NOT NULL,
  slug            text UNIQUE NOT NULL,
  content         text,
  status          text DEFAULT 'draft',
  seo_title       text,
  seo_description text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Site-level settings (key-value, e.g. store name, contact info)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        text UNIQUE NOT NULL,
  value      jsonb NOT NULL DEFAULT '{}',
  category   text NOT NULL DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- CMS content blocks (hero banners, sections, etc.)
CREATE TABLE IF NOT EXISTS public.cms_content (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  section     text NOT NULL,
  block_key   text NOT NULL,
  title       text,
  subtitle    text,
  content     text,
  image_url   text,
  button_text text,
  button_url  text,
  metadata    jsonb DEFAULT '{}',
  sort_order  integer DEFAULT 0,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(section, block_key)
);

-- Promotional banners
CREATE TABLE IF NOT EXISTS public.banners (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             text NOT NULL,
  type             text NOT NULL DEFAULT 'promotional',
  title            text,
  subtitle         text,
  image_url        text,
  background_color text DEFAULT '#000000',
  text_color       text DEFAULT '#FFFFFF',
  button_text      text,
  button_url       text,
  start_date       timestamptz,
  end_date         timestamptz,
  is_active        boolean DEFAULT true,
  position         text DEFAULT 'top',
  sort_order       integer DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Navigation menus
CREATE TABLE IF NOT EXISTS public.navigation_menus (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Navigation menu items (self-referencing for nested menus)
CREATE TABLE IF NOT EXISTS public.navigation_items (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id     uuid REFERENCES public.navigation_menus(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES public.navigation_items(id) ON DELETE CASCADE,
  label       text NOT NULL,
  url         text NOT NULL,
  icon        text,
  is_external boolean DEFAULT false,
  is_active   boolean DEFAULT true,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Feature flag toggles for store modules (POS, blog, coupons, etc.)
CREATE TABLE IF NOT EXISTS public.store_modules (
  id         text PRIMARY KEY,
  enabled    boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- Consolidated customer table (guests + registered)
CREATE TABLE IF NOT EXISTS public.customers (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           text UNIQUE NOT NULL,
  phone           text,
  full_name       text,
  first_name      text,
  last_name       text,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  default_address jsonb,
  notes           text,
  tags            text[],
  total_orders    integer DEFAULT 0,
  total_spent     numeric DEFAULT 0,
  last_order_at   timestamptz,
  secondary_phone text,
  secondary_email text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ============================================================
-- 5. INDEXES
-- ============================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Addresses
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Categories
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_status_featured_created
  ON products(status, featured, created_at DESC)
  WHERE status = 'active' AND featured = true;

-- Product images & variants
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_variant_id ON product_images(variant_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

-- Coupons
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_pending_reminders
  ON orders(created_at)
  WHERE payment_status = 'pending' AND payment_reminder_sent = false;

-- Order items
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- Blog
CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status);

-- Support
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_secondary_email ON customers(secondary_email);
CREATE INDEX IF NOT EXISTS idx_customers_secondary_phone ON customers(secondary_phone);

-- ============================================================
-- 6. TRIGGERS
-- ============================================================

-- updated_at auto-management
CREATE OR REPLACE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON blog_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_return_requests_updated_at BEFORE UPDATE ON return_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_store_settings_updated_at BEFORE UPDATE ON store_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_pages_updated_at BEFORE UPDATE ON pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Recalculate product rating on review changes
CREATE OR REPLACE TRIGGER tr_update_product_rating AFTER INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION update_product_rating_stats();
CREATE OR REPLACE TRIGGER tr_update_product_rating AFTER UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_product_rating_stats();
CREATE OR REPLACE TRIGGER tr_update_product_rating AFTER DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION update_product_rating_stats();

-- Auto-create profile for new Supabase Auth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7a. RLS POLICIES — Profiles
-- ============================================================
CREATE POLICY "Users view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Staff view any profile" ON profiles FOR SELECT USING (is_admin_or_staff());

-- ============================================================
-- 7b. RLS POLICIES — Addresses
-- ============================================================
CREATE POLICY "Users manage own addresses" ON addresses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manage all addresses" ON addresses FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7c. RLS POLICIES — Store Settings
-- ============================================================
CREATE POLICY "Staff view settings" ON store_settings FOR SELECT USING (true);
CREATE POLICY "Staff manage settings" ON store_settings FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7d. RLS POLICIES — Audit Logs
-- ============================================================
CREATE POLICY "Staff view audit logs" ON audit_logs FOR SELECT USING (is_admin_or_staff());
CREATE POLICY "Staff insert audit logs" ON audit_logs FOR INSERT WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7e. RLS POLICIES — Categories
-- ============================================================
CREATE POLICY "Public view categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Staff manage categories" ON categories FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7f. RLS POLICIES — Products
-- ============================================================
CREATE POLICY "Allow public read" ON products FOR SELECT USING (true);
CREATE POLICY "Public view active products" ON products FOR SELECT USING (status = 'active' OR is_admin_or_staff());
CREATE POLICY "Staff manage products" ON products FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7g. RLS POLICIES — Product Images
-- ============================================================
CREATE POLICY "Public view images" ON product_images FOR SELECT USING (true);
CREATE POLICY "Staff manage images" ON product_images FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7h. RLS POLICIES — Product Variants
-- ============================================================
CREATE POLICY "Public view variants" ON product_variants FOR SELECT USING (true);
CREATE POLICY "Staff manage variants" ON product_variants FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7i. RLS POLICIES — Coupons
-- ============================================================
CREATE POLICY "Allow anon read access to coupons" ON coupons FOR SELECT TO anon USING (true);
CREATE POLICY "Allow authenticated read access to coupons" ON coupons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin insert on coupons" ON coupons FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')));
CREATE POLICY "Allow admin update on coupons" ON coupons FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')));
CREATE POLICY "Allow admin delete on coupons" ON coupons FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')));

-- ============================================================
-- 7j. RLS POLICIES — Orders
-- ============================================================
CREATE POLICY "Users view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Enable select for guest orders" ON orders FOR SELECT USING (user_id IS NULL);
CREATE POLICY "Enable insert for all users" ON orders FOR INSERT
  WITH CHECK ((auth.uid() IS NOT NULL AND auth.uid() = user_id) OR (auth.uid() IS NULL AND user_id IS NULL));
CREATE POLICY "Allow bot to insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff manage all orders" ON orders FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7k. RLS POLICIES — Order Items
-- ============================================================
CREATE POLICY "Users view own order items" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Enable select for guest order items" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id IS NULL));
CREATE POLICY "Enable insert for order items" ON order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)));
CREATE POLICY "Staff manage order items" ON order_items FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7l. RLS POLICIES — Order Status History
-- ============================================================
CREATE POLICY "Users view order history" ON order_status_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Staff manage order history" ON order_status_history FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7m. RLS POLICIES — Cart & Wishlist
-- ============================================================
CREATE POLICY "Users manage own cart" ON cart_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own wishlist" ON wishlist_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 7n. RLS POLICIES — Reviews
-- ============================================================
CREATE POLICY "Public view approved reviews" ON reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "Users view own reviews" ON reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reviews" ON reviews FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manage reviews" ON reviews FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7o. RLS POLICIES — Review Images
-- ============================================================
CREATE POLICY "Public view review images" ON review_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM reviews WHERE reviews.id = review_images.review_id AND reviews.status = 'approved'));
CREATE POLICY "Users manage review images" ON review_images FOR ALL
  USING (EXISTS (SELECT 1 FROM reviews WHERE reviews.id = review_images.review_id AND reviews.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM reviews WHERE reviews.id = review_images.review_id AND reviews.user_id = auth.uid()));

-- ============================================================
-- 7p. RLS POLICIES — Blog Posts
-- ============================================================
CREATE POLICY "Public view published posts" ON blog_posts FOR SELECT USING (status = 'published' OR is_admin_or_staff());
CREATE POLICY "Staff manage blog" ON blog_posts FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7q. RLS POLICIES — Support
-- ============================================================
CREATE POLICY "Users manage own tickets" ON support_tickets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manage tickets" ON support_tickets FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());
CREATE POLICY "Users view ticket messages" ON support_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_messages.ticket_id AND support_tickets.user_id = auth.uid()));
CREATE POLICY "Users create messages" ON support_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_messages.ticket_id AND support_tickets.user_id = auth.uid()));
CREATE POLICY "Staff manage messages" ON support_messages FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7r. RLS POLICIES — Returns
-- ============================================================
CREATE POLICY "Users view own returns" ON return_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create returns" ON return_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manage returns" ON return_requests FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());
CREATE POLICY "Users view return items" ON return_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM return_requests WHERE return_requests.id = return_items.return_request_id AND return_requests.user_id = auth.uid()));
CREATE POLICY "Staff manage return items" ON return_items FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- ============================================================
-- 7s. RLS POLICIES — Notifications
-- ============================================================
CREATE POLICY "Users manage own notifications" ON notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 7t. RLS POLICIES — Pages & CMS
-- ============================================================
CREATE POLICY "Public can view pages" ON pages FOR SELECT USING (true);
CREATE POLICY "Staff can manage pages" ON pages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')));
CREATE POLICY "Allow public read on site_settings" ON site_settings FOR SELECT USING (true);
CREATE POLICY "Allow admin write on site_settings" ON site_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Allow public read on cms_content" ON cms_content FOR SELECT USING (is_active = true);
CREATE POLICY "Allow admin all on cms_content" ON cms_content FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- ============================================================
-- 7u. RLS POLICIES — Banners
-- ============================================================
CREATE POLICY "Allow public read on banners" ON banners FOR SELECT USING (is_active = true);
CREATE POLICY "Allow admin all on banners" ON banners FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- ============================================================
-- 7v. RLS POLICIES — Navigation
-- ============================================================
CREATE POLICY "Allow public read on navigation_menus" ON navigation_menus FOR SELECT USING (true);
CREATE POLICY "Allow admin all on navigation_menus" ON navigation_menus FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Allow public read on navigation_items" ON navigation_items FOR SELECT USING (is_active = true);
CREATE POLICY "Allow admin all on navigation_items" ON navigation_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- ============================================================
-- 7w. RLS POLICIES — Store Modules
-- ============================================================
CREATE POLICY "Allow public read access" ON store_modules FOR SELECT USING (true);
CREATE POLICY "Allow admin insert on store_modules" ON store_modules FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')));
CREATE POLICY "Allow authenticated update" ON store_modules FOR UPDATE
  USING (auth.role() IN ('authenticated', 'anon'));

-- ============================================================
-- 7x. RLS POLICIES — Customers
-- ============================================================
CREATE POLICY "Staff can view all customers" ON customers FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')));
CREATE POLICY "Staff can manage customers" ON customers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')));
CREATE POLICY "Service role full access to customers" ON customers FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 8. STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('blog', 'blog', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('reviews', 'reviews', true) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. STORAGE POLICIES
-- ============================================================

-- Products bucket: public read, authenticated upload/delete
CREATE POLICY "Allow public read on products bucket" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "Allow authenticated upload to products" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'products');
CREATE POLICY "Allow authenticated update products" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'products');
CREATE POLICY "Allow authenticated delete from products" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'products');

-- Media bucket: public read, authenticated upload/delete
CREATE POLICY "Allow public read on media bucket" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "Allow authenticated upload to media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');
CREATE POLICY "Allow authenticated update media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'media');
CREATE POLICY "Allow authenticated delete from media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media');

-- ============================================================
-- END OF MIGRATION
-- ============================================================
