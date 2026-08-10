/**
 * Product catalog channel visibility.
 * - global: shown on the website storefront and in POS
 * - pos_only: walk-in / POS only — hidden from shop, search, sitemap, etc.
 *
 * Stored on `products.metadata.visibility` so it works without a schema
 * migration. When `products.visibility` column exists (see migration
 * 20260810120000_product_visibility.sql), prefer that column.
 */
export type ProductVisibility = 'global' | 'pos_only';

export const DEFAULT_PRODUCT_VISIBILITY: ProductVisibility = 'global';

export function normalizeProductVisibility(value?: string | null): ProductVisibility {
  const normalized = (value || '').toLowerCase().trim();
  if (normalized === 'pos_only' || normalized === 'pos-only' || normalized === 'pos') {
    return 'pos_only';
  }
  return 'global';
}

/** Resolve visibility from column and/or metadata. */
export function getProductVisibility(product: {
  visibility?: string | null;
  metadata?: { visibility?: string | null } | null;
}): ProductVisibility {
  if (product.visibility != null && String(product.visibility).trim() !== '') {
    return normalizeProductVisibility(product.visibility);
  }
  return normalizeProductVisibility(product.metadata?.visibility);
}

export function isStorefrontVisible(product: {
  status?: string | null;
  visibility?: string | null;
  metadata?: { visibility?: string | null } | null;
}): boolean {
  return (
    (product.status || '').toLowerCase() === 'active' &&
    getProductVisibility(product) === 'global'
  );
}

/**
 * Apply storefront catalog filters.
 * Uses metadata.visibility (works without a DB column). Null/missing = global.
 */
export function applyStorefrontProductFilter<T>(query: T): T {
  const q = query as any;
  return q
    .eq('status', 'active')
    .or('metadata->>visibility.is.null,metadata->>visibility.eq.global') as T;
}
