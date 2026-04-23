import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Admin-only route to call mark_order_paid.  Used by POS cash/card sales.
 *
 * The RPC is locked down (no public EXECUTE), so this route is the only
 * authenticated path that can flip payment_status to 'paid' outside the
 * Moolre callback/verify flow.
 */
export async function POST(request: Request) {
    const clientId = getClientIdentifier(request);
    const rl = checkRateLimit(`admin-mark-paid:${clientId}`, RATE_LIMITS.payment);
    if (!rl.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const auth = await verifyAuth(request, { requireAdmin: true });
    if (!auth.authenticated) {
        return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { orderNumber, reference } = body ?? {};

        if (!orderNumber || typeof orderNumber !== 'string' || !/^ORD-\d+-\d+$/.test(orderNumber)) {
            return NextResponse.json({ error: 'Invalid order number' }, { status: 400 });
        }

        const moolreRef = typeof reference === 'string' && reference.trim()
            ? reference.trim().slice(0, 120)
            : `admin-${auth.user?.email ?? 'staff'}-${Date.now()}`;

        const { data, error } = await supabaseAdmin.rpc('mark_order_paid', {
            order_ref: orderNumber,
            moolre_ref: moolreRef,
        });

        if (error) {
            console.error('[admin/mark-paid] RPC error:', error.message);
            return NextResponse.json({ error: 'Failed to mark order as paid' }, { status: 500 });
        }

        return NextResponse.json({ success: true, order: data });
    } catch (err: any) {
        console.error('[admin/mark-paid] Error:', err?.message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
