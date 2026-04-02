/**
 * Image shown for a line item: checkout snapshot (variant image), then DB variant, then product gallery.
 */
export function orderLineItemImageUrl(item: {
  metadata?: { image?: unknown } | null;
  product_variants?: { image_url?: string | null } | { image_url?: string | null }[] | null;
  products?: { product_images?: { url?: string | null }[] | null } | null;
}): string | null {
  const meta = item.metadata?.image;
  if (typeof meta === 'string' && meta.trim()) return meta.trim();
  const pv = item.product_variants;
  const variantRow = Array.isArray(pv) ? pv[0] : pv;
  const vImg = variantRow?.image_url;
  if (typeof vImg === 'string' && vImg.trim()) return vImg.trim();
  const first = item.products?.product_images?.[0]?.url;
  if (typeof first === 'string' && first.trim()) return first.trim();
  return null;
}
