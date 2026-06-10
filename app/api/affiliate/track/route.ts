import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { AFFILIATE_COOKIE, DEFAULT_AFFILIATE_SETTINGS } from '@/lib/affiliate';

function hashIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for') || '';
  const ip = fwd.split(',')[0].trim();
  if (!ip) return null;
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

/**
 * POST /api/affiliate/track
 * Body: { code, path?, productId? }
 * Validates an affiliate code; if it maps to an ACTIVE affiliate, sets the
 * attribution cookie (last-click, configurable window) and logs the click.
 */
export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { /* noop */ }
  const code = (body.code || '').toString().trim();
  if (!code) return NextResponse.json({ affiliate: null });

  const { data: affiliate } = await supabaseAdmin
    .from('affiliates')
    .select('id, code, commission_pct, full_name, status')
    .eq('code', code)
    .maybeSingle();

  if (!affiliate || affiliate.status !== 'active') {
    return NextResponse.json({ affiliate: null });
  }

  // Attribution window from settings (fallback 30d)
  let attributionDays = DEFAULT_AFFILIATE_SETTINGS.attribution_days;
  try {
    const { data: setting } = await supabaseAdmin
      .from('site_settings').select('value').eq('key', 'affiliate').single();
    if (typeof setting?.value?.attribution_days === 'number') attributionDays = setting.value.attribution_days;
  } catch { /* defaults */ }

  // Log the click (best-effort)
  try {
    await supabaseAdmin.from('affiliate_clicks').insert({
      affiliate_id: affiliate.id,
      code: affiliate.code,
      landing_path: (body.path || '').toString().slice(0, 500) || null,
      product_id: body.productId || null,
      ip_hash: hashIp(req),
      user_agent: (req.headers.get('user-agent') || '').slice(0, 300) || null,
      referrer: (req.headers.get('referer') || '').slice(0, 500) || null,
    });
  } catch { /* don't block attribution on logging */ }

  const res = NextResponse.json({
    affiliate: { code: affiliate.code, commission_pct: affiliate.commission_pct, full_name: affiliate.full_name },
  });

  res.cookies.set(AFFILIATE_COOKIE, affiliate.code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: attributionDays * 24 * 60 * 60,
  });

  return res;
}
