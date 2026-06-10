import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { AFFILIATE_COOKIE, DEFAULT_AFFILIATE_SETTINGS, clampPct, type ProductMarkupMap } from '@/lib/affiliate';

/**
 * GET /api/affiliate/active
 * Reads the attribution cookie and returns the currently attributed affiliate
 * (code + default commission %) if it still maps to an ACTIVE affiliate, plus
 * the program markup cap and the affiliate's per-product markup map. Used by
 * the storefront to apply the (possibly product-specific) markup for display.
 */
export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${AFFILIATE_COOKIE}=([^;]+)`));
  const code = match ? decodeURIComponent(match[1].trim()) : '';

  if (!code) return NextResponse.json({ affiliate: null });

  const { data: affiliate } = await supabaseAdmin
    .from('affiliates')
    .select('id, code, commission_pct, full_name, status')
    .eq('code', code)
    .maybeSingle();

  if (!affiliate || affiliate.status !== 'active') {
    // Cookie is stale (affiliate suspended/removed) — clear it.
    const res = NextResponse.json({ affiliate: null });
    res.cookies.set(AFFILIATE_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }

  // Program-wide max markup cap.
  let cap = DEFAULT_AFFILIATE_SETTINGS.max_commission_pct;
  try {
    const { data: setting } = await supabaseAdmin
      .from('site_settings').select('value').eq('key', 'affiliate').single();
    if (typeof setting?.value?.max_commission_pct === 'number') cap = setting.value.max_commission_pct;
  } catch { /* default cap */ }

  // Per-product overrides for this affiliate (admin-approved only).
  const { data: rows } = await supabaseAdmin
    .from('affiliate_product_markups')
    .select('product_id, markup_pct')
    .eq('affiliate_id', affiliate.id)
    .eq('status', 'approved');

  const markups: ProductMarkupMap = {};
  for (const r of rows || []) markups[r.product_id as string] = clampPct(Number(r.markup_pct), cap);

  return NextResponse.json({
    affiliate: {
      code: affiliate.code,
      commission_pct: clampPct(Number(affiliate.commission_pct), cap),
      full_name: affiliate.full_name,
    },
    cap,
    markups,
  });
}
