import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendOrderConfirmation } from '@/lib/notifications';
import MOOLRE_BACKFILL_ORDER_NUMBERS from '@/lib/data/moolre-reconciled-order-numbers.json';

const PRESET_KEY = 'moolre_mar2026_reconcile';

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * POST — resend order confirmation email + customer SMS (same copy as payment callback).
 * Admin/staff only. Use `preset` for the known Moolre backfill list, or pass `orderNumbers`.
 *
 * Body: { preset?: "moolre_mar2026_reconcile", orderNumbers?: string[] }
 * - `customerOnly` is always true (no duplicate admin email/SMS per order).
 */
export async function POST(request: Request) {
    const auth = await verifyAuth(request, { requireAdmin: true, requireFullStaff: true });
    if (!auth.authenticated) {
        return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    let body: { preset?: string; orderNumbers?: string[] } = {};
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let orderNumbers: string[] = [];
    if (body.preset === PRESET_KEY) {
        orderNumbers = [...(MOOLRE_BACKFILL_ORDER_NUMBERS as string[])];
    } else if (Array.isArray(body.orderNumbers)) {
        orderNumbers = body.orderNumbers.map((s) => String(s).trim()).filter(Boolean);
    }

    if (orderNumbers.length === 0) {
        return NextResponse.json(
            {
                error: `Provide orderNumbers (non-empty array) or preset: "${PRESET_KEY}"`
            },
            { status: 400 }
        );
    }

    if (orderNumbers.length > 150) {
        return NextResponse.json({ error: 'Maximum 150 orders per request' }, { status: 400 });
    }

    const results: { order_number: string; ok: boolean; detail?: string }[] = [];

    for (const ref of orderNumbers) {
        const { data: order, error } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('order_number', ref)
            .maybeSingle();

        if (error || !order) {
            results.push({ order_number: ref, ok: false, detail: 'not_found' });
            await sleep(80);
            continue;
        }

        if (order.payment_status !== 'paid') {
            results.push({ order_number: ref, ok: false, detail: 'not_paid' });
            await sleep(80);
            continue;
        }

        try {
            await sendOrderConfirmation(order, { customerOnly: true });
            results.push({ order_number: ref, ok: true });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'send_failed';
            results.push({ order_number: ref, ok: false, detail: msg });
        }

        await sleep(400);
    }

    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json({
        message: `Processed ${results.length} orders; ${okCount} confirmation sends attempted.`,
        ok: okCount,
        failed: results.length - okCount,
        results
    });
}
