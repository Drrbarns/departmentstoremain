import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import { sendOrderConfirmation } from '@/lib/notifications';

const MAX_ORDERS = 80;
const DELAY_MS = 400;

/**
 * Bulk resend order confirmation email + customer SMS (same copy as checkout confirmation).
 * Skips duplicate admin email/SMS (skipAdminNotifications) to avoid spamming staff.
 *
 * Auth: admin or staff JWT, OR Authorization: Bearer <CRON_SECRET> (for trusted server-side runs).
 */
export async function POST(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization') || '';
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCron) {
        const auth = await verifyAuth(request, { requireAdmin: true, requireFullStaff: true });
        if (!auth.authenticated) {
            return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
        }
    }

    let body: { order_numbers?: string[] };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const refs = body.order_numbers;
    if (!Array.isArray(refs) || refs.length === 0) {
        return NextResponse.json({ error: 'order_numbers array required' }, { status: 400 });
    }
    if (refs.length > MAX_ORDERS) {
        return NextResponse.json({ error: `Maximum ${MAX_ORDERS} orders per request` }, { status: 400 });
    }

    const results: { order_number: string; ok: boolean; error?: string }[] = [];

    for (const order_number of refs) {
        const ref = String(order_number).trim();
        if (!ref) continue;

        const { data: order, error: fetchErr } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('order_number', ref)
            .maybeSingle();

        if (fetchErr || !order) {
            results.push({ order_number: ref, ok: false, error: fetchErr?.message || 'Order not found' });
            continue;
        }

        if (order.payment_status !== 'paid') {
            results.push({ order_number: ref, ok: false, error: 'Order is not paid; confirmation not sent' });
            continue;
        }

        try {
            await sendOrderConfirmation(order, { skipAdminNotifications: true });
            results.push({ order_number: ref, ok: true });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Send failed';
            results.push({ order_number: ref, ok: false, error: msg });
        }

        await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    return NextResponse.json({
        success: failed.length === 0,
        sent: ok,
        failed_count: failed.length,
        results,
    });
}
