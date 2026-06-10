import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { matureDueCommissions, disburseViaMoolre } from '@/lib/affiliate-server';
import { round2 } from '@/lib/affiliate';

function getAccessToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/\bsb-access-token=([^;]+)/);
  if (match) return decodeURIComponent(match[1].trim());
  const authCookie = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('sb-') && (c.includes('-auth-token') || c.includes('auth')));
  if (!authCookie) return null;
  const value = authCookie.split('=').slice(1).join('=').trim();
  const decoded = decodeURIComponent(value);
  try {
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed) && parsed[0]) return parsed[0];
    if (parsed?.access_token) return parsed.access_token;
    if (typeof parsed === 'string') return parsed;
  } catch {
    return decoded;
  }
  return null;
}

async function requireAdmin(request: Request): Promise<{ user: any } | NextResponse> {
  const token = getAccessToken(request);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role != null ? String(profile.role) : '';
  if (role !== 'admin' && role !== 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return { user };
}

// GET — affiliate detail with commissions + payouts
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  await matureDueCommissions(id);

  const [{ data: affiliate }, { data: commissions }, { data: payouts }, { data: markupRows }] = await Promise.all([
    supabaseAdmin.from('affiliates').select('*').eq('id', id).single(),
    supabaseAdmin.from('affiliate_commissions').select('*').eq('affiliate_id', id).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('affiliate_payouts').select('*').eq('affiliate_id', id).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('affiliate_product_markups')
      .select('id, product_id, markup_type, markup_pct, fixed_price, status, updated_at, products(name, slug, price)')
      .eq('affiliate_id', id)
      .order('updated_at', { ascending: false }),
  ]);

  if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

  // First image per product for the markups list.
  const productIds = (markupRows || []).map((r: any) => r.product_id);
  const imageMap = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: imgs } = await supabaseAdmin
      .from('product_images').select('product_id, url, position').in('product_id', productIds).order('position', { ascending: true });
    for (const img of imgs || []) {
      if (!imageMap.has(img.product_id as string)) imageMap.set(img.product_id as string, img.url as string);
    }
  }

  const markups = (markupRows || []).map((r: any) => {
    const base = Number(r.products?.price) || 0;
    const pct = Number(r.markup_pct) || 0;
    return {
      id: r.id,
      product_id: r.product_id,
      markup_type: r.markup_type,
      markup_pct: pct,
      fixed_price: r.fixed_price !== null ? Number(r.fixed_price) : null,
      status: r.status || 'approved',
      product_name: r.products?.name || 'Product',
      product_slug: r.products?.slug || '',
      base_price: base,
      customer_price: Math.round(base * (1 + pct / 100) * 100) / 100,
      image: imageMap.get(r.product_id) || null,
    };
  });

  return NextResponse.json({ affiliate, commissions: commissions || [], payouts: payouts || [], markups });
}

// PATCH — approve / reject a per-product markup. body: { markup_id, action }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const markupId = String(body.markup_id || '');
  const action = body.action;
  if (!markupId || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'markup_id and a valid action are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('affiliate_product_markups')
    .update({ status: action === 'approve' ? 'approved' : 'rejected', updated_at: new Date().toISOString() })
    .eq('id', markupId)
    .eq('affiliate_id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ markup: data });
}

// POST — record a manual payout of the affiliate's available balance.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  await matureDueCommissions(id);

  const { data: affiliate } = await supabaseAdmin.from('affiliates').select('*').eq('id', id).single();
  if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

  const amount = round2(affiliate.balance_available);
  if (amount <= 0) return NextResponse.json({ error: 'No available balance to pay out.' }, { status: 400 });

  // Is automatic disbursement enabled + configured?
  let autoDisburse = false;
  try {
    const { data: setting } = await supabaseAdmin.from('site_settings').select('value').eq('key', 'affiliate').single();
    autoDisburse = setting?.value?.auto_disburse === true;
  } catch { /* default off */ }
  // `body.manual === true` lets the admin force a manual record even when auto is on.
  const tryAuto = autoDisburse && body.manual !== true && !!process.env.MOOLRE_API_KEY;

  const externalref = `AFFPAY-${id.slice(0, 8)}-${Date.now()}`;

  // Create the payout record first (processing for auto, paid for manual).
  const { data: payout, error: payoutErr } = await supabaseAdmin
    .from('affiliate_payouts')
    .insert({
      affiliate_id: id,
      amount,
      method: 'momo',
      destination: affiliate.payout_number,
      provider: affiliate.payout_provider,
      status: tryAuto ? 'processing' : 'paid',
      moolre_ref: tryAuto ? externalref : (body.reference || null),
      processed_by: auth.user.id,
      processed_at: tryAuto ? null : new Date().toISOString(),
    })
    .select()
    .single();
  if (payoutErr) return NextResponse.json({ error: payoutErr.message }, { status: 500 });

  // Attempt the automatic Moolre transfer.
  if (tryAuto) {
    const result = await disburseViaMoolre({
      amount,
      receiver: affiliate.payout_number,
      provider: affiliate.payout_provider,
      externalref,
      reference: `Affiliate ${affiliate.code} commission`,
    });
    if (!result.ok) {
      await supabaseAdmin.from('affiliate_payouts')
        .update({ status: 'failed', failure_reason: result.message })
        .eq('id', payout.id);
      return NextResponse.json({ error: `Payout failed: ${result.message}` }, { status: 502 });
    }
    await supabaseAdmin.from('affiliate_payouts')
      .update({ status: 'paid', moolre_ref: result.transactionid || externalref, processed_at: new Date().toISOString() })
      .eq('id', payout.id);
  }

  // Mark all matured commissions as paid under this payout.
  await supabaseAdmin
    .from('affiliate_commissions')
    .update({ status: 'paid', payout_id: payout.id, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('affiliate_id', id)
    .eq('status', 'matured');

  // Move available balance to total paid.
  await supabaseAdmin
    .from('affiliates')
    .update({
      balance_available: round2(Math.max(0, affiliate.balance_available - amount)),
      total_paid: round2((affiliate.total_paid || 0) + amount),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  return NextResponse.json({ success: true, payout, auto: tryAuto });
}
