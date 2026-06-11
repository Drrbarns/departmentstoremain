import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';

/**
 * Admin Sales management endpoint.
 *
 * POST body (one of):
 *   { action: 'apply',  mode: 'percentage', value: <1-99>,  productIds: string[] }
 *   { action: 'apply',  mode: 'fixed',      value: <price>, productIds: string[] }
 *   { action: 'remove',                                     productIds: string[] }
 *   { action: 'set_active', active: boolean }   // master on/off for ALL sales
 *
 * All price math runs server-side in SQL functions (apply_sale_percentage /
 * apply_sale_fixed / remove_sale / pause_all_sales / resume_all_sales) so the
 * client can never set an arbitrary charged price, the "regular" price is
 * derived from authoritative DB values, and variant products are kept in sync
 * (checkout charges the variant price).
 */

const MAX_IDS = 2000;
const SALES_ACTIVE_KEY = 'sales_active';

function isUuid(v: unknown): v is string {
    return typeof v === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Reads the master sales switch. Defaults to ON if the row is missing. */
async function salesAreActive(): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from('site_settings')
        .select('value')
        .eq('key', SALES_ACTIVE_KEY)
        .maybeSingle();
    if (!data) return true;
    // jsonb boolean comes back as a real boolean; tolerate string forms too.
    return data.value === true || data.value === 'true';
}

export async function POST(request: Request) {
    const auth = await verifyAuth(request, { requireAdmin: true, requireFullStaff: true });
    if (!auth.authenticated) {
        return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const action = String(body?.action || '');

    // Master on/off switch for the whole campaign. Handled before the
    // productIds validation below since it operates on all sale products.
    if (action === 'set_active') {
        const active = body?.active === true;
        try {
            if (active) {
                const { data, error } = await supabaseAdmin.rpc('resume_all_sales');
                if (error) throw error;
                const { error: setErr } = await supabaseAdmin
                    .from('site_settings')
                    .upsert({ key: SALES_ACTIVE_KEY, value: true }, { onConflict: 'key' });
                if (setErr) throw setErr;
                return NextResponse.json({ success: true, action, active: true, result: data });
            } else {
                const { data, error } = await supabaseAdmin.rpc('pause_all_sales');
                if (error) throw error;
                const { error: setErr } = await supabaseAdmin
                    .from('site_settings')
                    .upsert({ key: SALES_ACTIVE_KEY, value: false }, { onConflict: 'key' });
                if (setErr) throw setErr;
                return NextResponse.json({ success: true, action, active: false, result: data });
            }
        } catch (err: any) {
            console.error('[admin/sales] set_active error:', err?.message || err);
            return NextResponse.json(
                { error: err?.message || 'Failed to toggle sales' },
                { status: 500 },
            );
        }
    }

    const rawIds: unknown = body?.productIds;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
        return NextResponse.json({ error: 'No products selected' }, { status: 400 });
    }
    if (rawIds.length > MAX_IDS) {
        return NextResponse.json(
            { error: `Too many products in one request (max ${MAX_IDS}). Apply in smaller batches.` },
            { status: 400 },
        );
    }
    const productIds = Array.from(new Set(rawIds.filter(isUuid)));
    if (productIds.length === 0) {
        return NextResponse.json({ error: 'No valid product IDs' }, { status: 400 });
    }

    // While the campaign is paused, editing individual sales would create an
    // inconsistent state (a discounted price showing while everything else is
    // at normal price). Require turning sales on first.
    if (!(await salesAreActive())) {
        return NextResponse.json(
            { error: 'Sales are turned off. Turn sales on before editing individual product sales.' },
            { status: 409 },
        );
    }

    try {
        if (action === 'remove') {
            const { data, error } = await supabaseAdmin.rpc('remove_sale', { p_ids: productIds });
            if (error) throw error;
            return NextResponse.json({ success: true, action, result: data });
        }

        if (action === 'apply') {
            const mode = String(body?.mode || '');
            const value = Number(body?.value);

            if (!Number.isFinite(value)) {
                return NextResponse.json({ error: 'Invalid value' }, { status: 400 });
            }

            if (mode === 'percentage') {
                if (value <= 0 || value >= 100) {
                    return NextResponse.json(
                        { error: 'Discount percent must be between 1 and 99' },
                        { status: 400 },
                    );
                }
                const { data, error } = await supabaseAdmin.rpc('apply_sale_percentage', {
                    p_ids: productIds,
                    p_pct: value,
                });
                if (error) throw error;
                return NextResponse.json({ success: true, action, mode, result: data });
            }

            if (mode === 'fixed') {
                if (value <= 0) {
                    return NextResponse.json(
                        { error: 'Sale price must be greater than 0' },
                        { status: 400 },
                    );
                }
                const { data, error } = await supabaseAdmin.rpc('apply_sale_fixed', {
                    p_ids: productIds,
                    p_price: Math.round(value * 100) / 100,
                });
                if (error) throw error;
                const updated = (data as any)?.products_updated ?? 0;
                return NextResponse.json({
                    success: true,
                    action,
                    mode,
                    result: data,
                    // Help the UI explain why a fixed price may have skipped some rows.
                    skipped: productIds.length - updated,
                    note:
                        updated < productIds.length
                            ? 'Some products were skipped: a fixed sale price only applies to products without variants and must be lower than the regular price. Use a percentage for variant products.'
                            : undefined,
                });
            }

            return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err: any) {
        console.error('[admin/sales] Error:', err?.message || err);
        return NextResponse.json(
            { error: err?.message || 'Failed to update sales' },
            { status: 500 },
        );
    }
}
