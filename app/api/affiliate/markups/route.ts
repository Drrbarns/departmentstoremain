import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { clampPct, priceToPct, round2, DEFAULT_AFFILIATE_SETTINGS } from '@/lib/affiliate';

/** Extract the Supabase access token from header or cookie. */
function getAccessToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/\bsb-access-token=([^;]+)/);
  if (match) return decodeURIComponent(match[1].trim());
  const authCookie = cookieHeader
    .split(';').map((c) => c.trim())
    .find((c) => c.startsWith('sb-') && (c.includes('-auth-token') || c.includes('auth')));
  if (!authCookie) return null;
  const value = authCookie.split('=').slice(1).join('=').trim();
  const decoded = decodeURIComponent(value);
  try {
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed) && parsed[0]) return parsed[0];
    if (parsed?.access_token) return parsed.access_token;
    if (typeof parsed === 'string') return parsed;
  } catch { return decoded; }
  return null;
}

async function resolveAffiliate(request: Request) {
  const token = getAccessToken(request);
  if (!token) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { error: NextResponse.json({ error: 'Invalid session' }, { status: 401 }) };
  const { data: affiliate } = await supabaseAdmin
    .from('affiliates').select('id, code, status, commission_pct, pending_commission_pct').eq('user_id', user.id).maybeSingle();
  if (!affiliate) return { error: NextResponse.json({ error: 'Not an affiliate' }, { status: 403 }) };
  return { affiliate };
}

async function getCap(): Promise<number> {
  try {
    const { data } = await supabaseAdmin.from('site_settings').select('value').eq('key', 'affiliate').single();
    if (typeof data?.value?.max_commission_pct === 'number') return data.value.max_commission_pct;
  } catch { /* default */ }
  return DEFAULT_AFFILIATE_SETTINGS.max_commission_pct;
}

// GET — affiliate's overrides (joined with product info), the cap and their
// default rate. Pass ?search=term to look up products to add an override to.
export async function GET(request: Request) {
  const { affiliate, error } = await resolveAffiliate(request);
  if (error) return error;

  const cap = await getCap();
  const url = new URL(request.url);
  const search = (url.searchParams.get('search') || '').trim();

  // Fetch the first image (lowest position) for a set of product ids.
  async function imageMapFor(ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;
    const { data: imgs } = await supabaseAdmin
      .from('product_images')
      .select('product_id, url, position')
      .in('product_id', ids)
      .order('position', { ascending: true });
    for (const img of imgs || []) {
      if (!map.has(img.product_id as string)) map.set(img.product_id as string, img.url as string);
    }
    return map;
  }

  // Existing overrides for this affiliate, joined to product fields.
  const { data: rows } = await supabaseAdmin
    .from('affiliate_product_markups')
    .select('id, product_id, markup_type, markup_pct, fixed_price, status, updated_at, products(name, slug, price)')
    .eq('affiliate_id', affiliate!.id)
    .order('updated_at', { ascending: false });

  const overrideImgs = await imageMapFor((rows || []).map((r: any) => r.product_id));
  const overrides = (rows || []).map((r: any) => ({
    id: r.id,
    product_id: r.product_id,
    markup_type: r.markup_type,
    markup_pct: Number(r.markup_pct),
    fixed_price: r.fixed_price !== null ? Number(r.fixed_price) : null,
    status: r.status || 'approved',
    product_name: r.products?.name || 'Product',
    product_slug: r.products?.slug || '',
    base_price: Number(r.products?.price) || 0,
    image: overrideImgs.get(r.product_id) || null,
  }));

  let results: any[] = [];
  if (search) {
    const { data: prods } = await supabaseAdmin
      .from('products')
      .select('id, name, slug, price, status, metadata')
      .ilike('name', `%${search}%`)
      .eq('status', 'active')
      .or('metadata->>visibility.is.null,metadata->>visibility.eq.global')
      .limit(15);
    const searchImgs = await imageMapFor((prods || []).map((p: any) => p.id));
    const overrideMap = new Map(overrides.map((o) => [o.product_id, o]));
    results = (prods || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      base_price: Number(p.price) || 0,
      image: searchImgs.get(p.id) || null,
      override: overrideMap.get(p.id) || null,
    }));
  }

  return NextResponse.json({
    cap,
    code: affiliate!.code,
    default_commission_pct: clampPct(Number(affiliate!.commission_pct) || 0, cap),
    pending_commission_pct: affiliate!.pending_commission_pct !== null && affiliate!.pending_commission_pct !== undefined
      ? clampPct(Number(affiliate!.pending_commission_pct), cap)
      : null,
    overrides,
    results,
  });
}

// POST — create/update a per-product override. body: { product_id, markup_type, value }
export async function POST(request: Request) {
  const { affiliate, error } = await resolveAffiliate(request);
  if (error) return error;
  if (affiliate!.status !== 'active') {
    return NextResponse.json({ error: 'Your affiliate account is not active yet.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const productId = String(body.product_id || '');
  const type = body.markup_type === 'price' ? 'price' : 'pct';
  const value = Number(body.value);

  if (!productId) return NextResponse.json({ error: 'Missing product_id' }, { status: 400 });
  if (!Number.isFinite(value) || value < 0) return NextResponse.json({ error: 'Invalid value' }, { status: 400 });

  const cap = await getCap();

  // Authoritative base price from the product.
  const { data: product } = await supabaseAdmin
    .from('products').select('id, price').eq('id', productId).maybeSingle();
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  const basePrice = Number(product.price) || 0;

  let markupPct: number;
  let fixedPrice: number | null = null;
  if (type === 'price') {
    fixedPrice = round2(value);
    markupPct = priceToPct(fixedPrice, basePrice, cap);
  } else {
    markupPct = clampPct(value, cap);
  }

  // Any create or edit lands as 'pending' — an admin must approve it before it
  // affects storefront pricing or commission.
  const { data: saved, error: upErr } = await supabaseAdmin
    .from('affiliate_product_markups')
    .upsert({
      affiliate_id: affiliate!.id,
      product_id: productId,
      markup_type: type,
      markup_pct: markupPct,
      fixed_price: fixedPrice,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'affiliate_id,product_id' })
    .select()
    .single();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ markup: saved });
}

// DELETE — remove an override. ?product_id=...
export async function DELETE(request: Request) {
  const { affiliate, error } = await resolveAffiliate(request);
  if (error) return error;

  const productId = new URL(request.url).searchParams.get('product_id') || '';
  if (!productId) return NextResponse.json({ error: 'Missing product_id' }, { status: 400 });

  const { error: delErr } = await supabaseAdmin
    .from('affiliate_product_markups')
    .delete()
    .eq('affiliate_id', affiliate!.id)
    .eq('product_id', productId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
