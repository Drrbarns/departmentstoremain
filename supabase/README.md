# Supabase Database Migrations

This folder contains the SQL migration for the Discount Discovery Zone e-commerce database.

## Migration File

### `20260327000000_complete_schema.sql`

A single, comprehensive migration (~1200 lines) that creates the entire database from scratch. It covers:

| Section | Contents |
|---------|----------|
| Extensions | `uuid-ossp` |
| Enum types (13) | `user_role`, `gender_type`, `address_type`, `product_status`, `category_status`, `order_status`, `payment_status`, `discount_type`, `review_status`, `blog_status`, `ticket_status`, `ticket_priority`, `return_status` |
| Functions (11) | `is_admin_or_staff`, `update_updated_at_column`, `handle_new_user`, `update_product_rating_stats`, `upsert_customer_from_order`, `update_customer_stats`, `mark_order_paid`, `reduce_stock_on_order`, `get_all_customer_emails`, `get_all_customer_phones`, `rls_auto_enable` |
| Tables (30) | `profiles`, `addresses`, `store_settings`, `audit_logs`, `categories`, `products`, `product_images`, `product_variants`, `coupons`, `orders`, `order_items`, `order_status_history`, `cart_items`, `wishlist_items`, `reviews`, `review_images`, `blog_posts`, `support_tickets`, `support_messages`, `return_requests`, `return_items`, `notifications`, `pages`, `site_settings`, `cms_content`, `banners`, `navigation_menus`, `navigation_items`, `store_modules`, `customers` |
| Indexes (40+) | B-tree, GIN (tags), partial indexes (pending reminders, unread notifications, featured products) |
| Triggers (16) | `updated_at` auto-management on 13 tables, product rating recalculation on review changes, profile creation on auth signup |
| RLS policies (68) | Row-level security on all 30 tables with role-based access control |
| Storage (5 buckets) | `products`, `avatars`, `blog`, `media`, `reviews` with read/write policies |

## How to Use

### Option 1: Supabase Dashboard (Recommended for first setup)

1. Go to your Supabase Dashboard → **SQL Editor**
2. Copy the contents of `20260327000000_complete_schema.sql`
3. Paste and run

### Option 2: Supabase CLI

```bash
# Link your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

## Database Schema Overview

### Core Tables
- **profiles** — User profile (auto-created on signup)
- **addresses** — Shipping/billing addresses
- **customers** — Consolidated customer records (guests + registered)

### Catalog
- **products** — Product catalog with MOQ, SEO, variants support
- **product_variants** — Size/color/option variations
- **product_images** — Product and variant images
- **categories** — Hierarchical categories (self-referencing `parent_id`)

### E-Commerce
- **orders** — Orders with Moolre payment integration
- **order_items** — Line items per order
- **order_status_history** — Status change audit trail
- **cart_items** — Server-side shopping cart
- **wishlist_items** — User wishlists
- **coupons** — Discount codes (percentage, fixed, free shipping)

### Reviews & Content
- **reviews** — Product reviews (1-5 rating, moderation)
- **review_images** — Images attached to reviews
- **blog_posts** — Blog/content marketing
- **pages** — Static pages (about, contact, etc.)
- **cms_content** — CMS content blocks
- **banners** — Promotional banners

### Support
- **support_tickets** — Customer support with auto-numbered tickets
- **support_messages** — Ticket conversation threads
- **return_requests** — Return/refund workflows
- **return_items** — Individual items in a return

### System
- **store_settings** — Key-value store settings
- **site_settings** — Site-level configuration
- **store_modules** — Feature flag toggles (POS, blog, etc.)
- **navigation_menus** / **navigation_items** — Dynamic menus
- **notifications** — In-app notifications
- **audit_logs** — Admin action trail

## Security

- RLS is enabled on **all 30 tables**
- `is_admin_or_staff()` helper function used across policies
- `rls_auto_enable` event trigger protects new tables automatically
- Service role bypass for server-side operations (customers table)
- Guest order support (orders with `user_id IS NULL`)

## Key Functions

| Function | Purpose |
|----------|---------|
| `mark_order_paid(order_ref, moolre_ref)` | Mark order paid, reduce stock, record payment |
| `upsert_customer_from_order(...)` | Create or deduplicate customer from checkout |
| `update_customer_stats(email, total)` | Increment order count and spend |
| `handle_new_user()` | Auto-create profile on signup (trigger) |
| `update_product_rating_stats()` | Recalculate product rating (trigger) |
