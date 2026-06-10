import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/** Extract the Supabase access token from Bearer header or sb cookies. */
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

async function requireAdmin(request: Request): Promise<NextResponse | null> {
  const token = getAccessToken(request);
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = profile?.role != null ? String(profile.role) : '';
  if (role !== 'admin' && role !== 'staff') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// GET — list affiliates (optionally filter by status) + program-wide KPIs
export async function GET(request: Request) {
  const err = await requireAdmin(request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  let query = supabaseAdmin
    .from('affiliates')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = data || [];

  // Per-affiliate performance metrics (clicks + converted orders).
  const enriched = await Promise.all(
    list.map(async (a) => {
      const [{ count: clicks }, { count: orders }] = await Promise.all([
        supabaseAdmin.from('affiliate_clicks').select('*', { count: 'exact', head: true }).eq('affiliate_id', a.id),
        supabaseAdmin.from('affiliate_commissions').select('*', { count: 'exact', head: true }).eq('affiliate_id', a.id),
      ]);
      return { ...a, clicks: clicks || 0, orders: orders || 0 };
    })
  );

  // Program-wide KPIs (independent of the status filter).
  const byStatus: Record<string, number> = { pending: 0, active: 0, suspended: 0, rejected: 0 };
  let totalEarned = 0, totalPaid = 0, pending = 0, available = 0;

  const { data: allAff } = await supabaseAdmin
    .from('affiliates')
    .select('status,total_earned,total_paid,balance_pending,balance_available');

  for (const a of allAff || []) {
    byStatus[a.status as string] = (byStatus[a.status as string] || 0) + 1;
    totalEarned += Number(a.total_earned || 0);
    totalPaid += Number(a.total_paid || 0);
    pending += Number(a.balance_pending || 0);
    available += Number(a.balance_available || 0);
  }

  const [{ count: totalClicks }, { count: totalOrders }, { count: pendingPrices }] = await Promise.all([
    supabaseAdmin.from('affiliate_clicks').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('affiliate_commissions').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('affiliate_product_markups').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const clicks = totalClicks || 0;
  const conversions = totalOrders || 0;

  const stats = {
    total: (allAff || []).length,
    byStatus,
    totalEarned: Math.round(totalEarned * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    pending: Math.round(pending * 100) / 100,
    available: Math.round(available * 100) / 100,
    clicks,
    conversions,
    conversionRate: clicks > 0 ? Math.round((conversions / clicks) * 1000) / 10 : 0,
    pendingPrices: pendingPrices || 0,
  };

  return NextResponse.json({ affiliates: enriched, stats });
}

// PATCH — update an affiliate (status, commission %, payout details, notes)
export async function PATCH(request: Request) {
  const err = await requireAdmin(request);
  if (err) return err;

  const body = await request.json();
  const { id, status, commission_pct, commission_action, payout_method, payout_number, payout_provider, payout_name, notes } = body;

  if (!id) return NextResponse.json({ error: 'Affiliate id is required' }, { status: 400 });

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  if (status !== undefined) {
    if (!['pending', 'active', 'suspended', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    updates.status = status;
    if (status === 'active') updates.approved_at = new Date().toISOString();
  }

  // Approve / reject an affiliate's requested commission %.
  if (commission_action === 'approve') {
    const { data: aff } = await supabaseAdmin
      .from('affiliates').select('pending_commission_pct').eq('id', id).single();
    if (aff?.pending_commission_pct === null || aff?.pending_commission_pct === undefined) {
      return NextResponse.json({ error: 'No pending commission request to approve.' }, { status: 400 });
    }
    updates.commission_pct = Number(aff.pending_commission_pct);
    updates.pending_commission_pct = null;
    updates.commission_requested_at = null;
  } else if (commission_action === 'reject') {
    updates.pending_commission_pct = null;
    updates.commission_requested_at = null;
  }

  if (commission_pct !== undefined) {
    const pct = Number(commission_pct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: 'Commission must be between 0 and 100' }, { status: 400 });
    }
    // An explicit admin-set rate overrides any outstanding request.
    updates.commission_pct = pct;
    updates.pending_commission_pct = null;
    updates.commission_requested_at = null;
  }

  if (payout_method !== undefined) updates.payout_method = payout_method || null;
  if (payout_number !== undefined) updates.payout_number = payout_number || null;
  if (payout_provider !== undefined) updates.payout_provider = payout_provider || null;
  if (payout_name !== undefined) updates.payout_name = payout_name || null;
  if (notes !== undefined) updates.notes = notes || null;

  const { data, error } = await supabaseAdmin
    .from('affiliates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ affiliate: data });
}
