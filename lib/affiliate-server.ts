/**
 * Server-only affiliate ledger helpers. Use supabaseAdmin (service role) — never
 * import into client components.
 *
 * Lifecycle of a commission:
 *   pending  → created when the order is paid (held for the maturity window)
 *   matured  → maturity window elapsed; counts toward payable balance
 *   paid     → included in a payout
 *   clawed_back → order refunded/cancelled before payout
 */
import { supabaseAdmin } from '@/lib/supabase-admin';
import { round2, clampPct, effectivePct, DEFAULT_AFFILIATE_SETTINGS, type ProductMarkupMap } from '@/lib/affiliate';

/** Reads the affiliate settings JSON (maturity + markup cap), with defaults. */
async function getAffiliateSettings(): Promise<{ maturityDays: number; cap: number }> {
  try {
    const { data } = await supabaseAdmin
      .from('site_settings').select('value').eq('key', 'affiliate').single();
    return {
      maturityDays: typeof data?.value?.maturity_days === 'number' ? data.value.maturity_days : DEFAULT_AFFILIATE_SETTINGS.maturity_days,
      cap: typeof data?.value?.max_commission_pct === 'number' ? data.value.max_commission_pct : DEFAULT_AFFILIATE_SETTINGS.max_commission_pct,
    };
  } catch {
    return { maturityDays: DEFAULT_AFFILIATE_SETTINGS.maturity_days, cap: DEFAULT_AFFILIATE_SETTINGS.max_commission_pct };
  }
}

/** Map a stored MoMo provider name to Moolre's transfer channel code. */
export function providerToChannel(provider?: string | null): string | null {
  const p = (provider || '').toLowerCase();
  if (p.includes('mtn')) return '1';
  if (p.includes('telecel') || p.includes('vodafone')) return '6';
  if (p.includes('airtel') || p.includes('tigo') || p === 'at') return '7';
  return null;
}

export interface DisburseResult {
  ok: boolean;
  transactionid?: string;
  fee?: string;
  message: string;
}

/**
 * Sends a mobile-money payout via Moolre's transfer API.
 * Requires MOOLRE_API_USER, MOOLRE_API_KEY (PRIVATE key), MOOLRE_ACCOUNT_NUMBER,
 * and sufficient float in the Moolre wallet. Returns ok=false on any failure
 * (caller should mark the payout failed and NOT touch balances).
 */
export async function disburseViaMoolre(opts: {
  amount: number;
  receiver: string;
  provider?: string | null;
  externalref: string;
  reference?: string;
}): Promise<DisburseResult> {
  const { MOOLRE_API_USER, MOOLRE_API_KEY, MOOLRE_ACCOUNT_NUMBER } = process.env;
  if (!MOOLRE_API_USER || !MOOLRE_API_KEY || !MOOLRE_ACCOUNT_NUMBER) {
    return { ok: false, message: 'Moolre transfer credentials not configured (MOOLRE_API_KEY required).' };
  }
  const channel = providerToChannel(opts.provider);
  if (!channel) return { ok: false, message: `Unknown MoMo provider: ${opts.provider || 'none'}` };
  if (!opts.receiver) return { ok: false, message: 'Missing recipient MoMo number.' };
  if (!opts.amount || opts.amount <= 0) return { ok: false, message: 'Invalid payout amount.' };

  try {
    const res = await fetch('https://api.moolre.com/open/transact/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-USER': MOOLRE_API_USER,
        'X-API-KEY': MOOLRE_API_KEY,
      },
      body: JSON.stringify({
        type: 1,
        channel,
        currency: 'GHS',
        amount: opts.amount.toFixed(2),
        receiver: opts.receiver,
        externalref: opts.externalref,
        reference: opts.reference || 'Affiliate commission payout',
        accountnumber: MOOLRE_ACCOUNT_NUMBER,
      }),
    });
    const result = await res.json();
    const apiOk = result.status === 1 || result.status === '1';
    const txOk = result.data?.txstatus === 1 || result.data?.txstatus === '1';
    if (apiOk && txOk) {
      return {
        ok: true,
        transactionid: String(result.data?.transactionid || ''),
        fee: String(result.data?.fee || ''),
        message: Array.isArray(result.message) ? result.message.join(' ') : String(result.message || 'Payout successful'),
      };
    }
    return { ok: false, message: Array.isArray(result.message) ? result.message.join(' ') : String(result.message || 'Transfer rejected') };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Network error contacting Moolre.' };
  }
}

/**
 * Records the affiliate commission for a paid order. Idempotent — safe to call
 * from both the webhook and the verify path. Commission is recomputed
 * authoritatively, per line item, from the affiliate's current markup config
 * (default rate + per-product overrides, clamped to the program cap) applied to
 * each item's base price — so it can't be tampered with client-side and honours
 * per-product custom pricing.
 */
export async function recordAffiliateCommission(orderRefOrId: string): Promise<void> {
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderRefOrId);
    const { data: order } = await (isUUID
      ? supabaseAdmin.from('orders').select('id, order_number, metadata').eq('id', orderRefOrId).single()
      : supabaseAdmin.from('orders').select('id, order_number, metadata').eq('order_number', orderRefOrId).single());

    if (!order) return;
    const aff = order.metadata?.affiliate;
    if (!aff || !aff.code) return; // not an affiliate order

    // Idempotency: skip if a commission already exists for this order.
    const { data: existing } = await supabaseAdmin
      .from('affiliate_commissions').select('id').eq('order_id', order.id).maybeSingle();
    if (existing) return;

    const { data: affiliate } = await supabaseAdmin
      .from('affiliates').select('id, commission_pct, balance_pending').eq('code', aff.code).maybeSingle();
    if (!affiliate) return;

    const { maturityDays, cap } = await getAffiliateSettings();
    const defaultPct = clampPct(Number(affiliate.commission_pct) || 0, cap);

    // Per-product overrides for this affiliate (admin-approved only).
    const { data: markupRows } = await supabaseAdmin
      .from('affiliate_product_markups')
      .select('product_id, markup_pct')
      .eq('affiliate_id', affiliate.id)
      .eq('status', 'approved');
    const markups: ProductMarkupMap = {};
    for (const r of markupRows || []) markups[r.product_id as string] = clampPct(Number(r.markup_pct), cap);

    // Recompute commission per line from each item's base price.
    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('product_id, quantity, unit_price, metadata')
      .eq('order_id', order.id);

    let baseAmount = 0;
    let commission = 0;
    for (const it of items || []) {
      const qty = Number(it.quantity) || 0;
      const base = Number(it.metadata?.base_unit_price ?? it.unit_price) || 0;
      const pct = effectivePct(it.product_id as string, markups, defaultPct, cap);
      baseAmount = round2(baseAmount + base * qty);
      commission = round2(commission + base * qty * (pct / 100));
    }
    baseAmount = round2(baseAmount);
    commission = round2(commission);
    if (commission <= 0) return;

    // Blended effective rate, for reporting on the commission row.
    const blendedPct = baseAmount > 0 ? round2((commission / baseAmount) * 100) : defaultPct;

    const maturesAt = new Date(Date.now() + maturityDays * 24 * 60 * 60 * 1000).toISOString();

    const { error: insErr } = await supabaseAdmin.from('affiliate_commissions').insert({
      affiliate_id: affiliate.id,
      order_id: order.id,
      order_number: order.order_number,
      base_amount: baseAmount,
      commission_pct: blendedPct,
      commission_amount: commission,
      status: 'pending',
      matures_at: maturesAt,
    });
    if (insErr) {
      // Unique-violation = concurrent insert already recorded it; ignore.
      if (!String(insErr.message || '').toLowerCase().includes('duplicate')) {
        console.error('[Affiliate] commission insert failed:', insErr.message);
      }
      return;
    }

    await supabaseAdmin
      .from('affiliates')
      .update({ balance_pending: round2((affiliate.balance_pending || 0) + commission) })
      .eq('id', affiliate.id);

    console.log(`[Affiliate] Recorded commission GHS ${commission} for order ${order.order_number}`);
  } catch (e: any) {
    console.error('[Affiliate] recordAffiliateCommission error:', e?.message || e);
  }
}

/**
 * Reverses a commission when its order is refunded/cancelled. Only commissions
 * that haven't been paid out can be clawed back.
 */
export async function clawbackAffiliateCommission(orderId: string): Promise<void> {
  try {
    const { data: commission } = await supabaseAdmin
      .from('affiliate_commissions')
      .select('id, affiliate_id, commission_amount, status')
      .eq('order_id', orderId)
      .maybeSingle();
    if (!commission) return;
    if (!['pending', 'matured'].includes(commission.status)) return; // already paid/clawed

    const { data: affiliate } = await supabaseAdmin
      .from('affiliates').select('balance_pending, balance_available').eq('id', commission.affiliate_id).single();

    const amt = round2(commission.commission_amount);
    const updates: Record<string, number> = {};
    if (commission.status === 'pending') {
      updates.balance_pending = round2(Math.max(0, (affiliate?.balance_pending || 0) - amt));
    } else {
      updates.balance_available = round2(Math.max(0, (affiliate?.balance_available || 0) - amt));
    }

    await supabaseAdmin.from('affiliate_commissions')
      .update({ status: 'clawed_back', updated_at: new Date().toISOString() })
      .eq('id', commission.id);
    await supabaseAdmin.from('affiliates').update(updates).eq('id', commission.affiliate_id);

    console.log(`[Affiliate] Clawed back commission for order ${orderId}`);
  } catch (e: any) {
    console.error('[Affiliate] clawbackAffiliateCommission error:', e?.message || e);
  }
}

/**
 * Lazily matures commissions whose hold window has elapsed (pending → matured),
 * moving the amount from pending to available balance. Called on dashboard/admin
 * reads so we don't need a cron. Pass an affiliateId to scope it.
 */
export async function matureDueCommissions(affiliateId?: string): Promise<void> {
  try {
    let q = supabaseAdmin
      .from('affiliate_commissions')
      .select('id, affiliate_id, commission_amount')
      .eq('status', 'pending')
      .lte('matures_at', new Date().toISOString());
    if (affiliateId) q = q.eq('affiliate_id', affiliateId);

    const { data: due } = await q;
    if (!due || due.length === 0) return;

    // Group by affiliate and apply balance shifts.
    const byAffiliate = new Map<string, number>();
    for (const c of due) {
      byAffiliate.set(c.affiliate_id, round2((byAffiliate.get(c.affiliate_id) || 0) + Number(c.commission_amount)));
    }

    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from('affiliate_commissions')
      .update({ status: 'matured', matured_at: nowIso, updated_at: nowIso })
      .in('id', due.map((c) => c.id));

    for (const [affId, amount] of byAffiliate) {
      const { data: aff } = await supabaseAdmin
        .from('affiliates').select('balance_pending, balance_available, total_earned').eq('id', affId).single();
      await supabaseAdmin.from('affiliates').update({
        balance_pending: round2(Math.max(0, (aff?.balance_pending || 0) - amount)),
        balance_available: round2((aff?.balance_available || 0) + amount),
        total_earned: round2((aff?.total_earned || 0) + amount),
      }).eq('id', affId);
    }
  } catch (e: any) {
    console.error('[Affiliate] matureDueCommissions error:', e?.message || e);
  }
}
