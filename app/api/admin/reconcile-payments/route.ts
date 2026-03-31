import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';

type ReconcileRow = {
    id: string;
    order_number: string | null;
    total: number | null;
    payment_status: string | null;
    payment_method: string | null;
    created_at: string | null;
    email: string | null;
    metadata: Record<string, unknown> | null;
};

/**
 * Lists Moolre orders where a payment link was generated (metadata.moolre_externalref)
 * but payment_status is not "paid". These are candidates for missed callbacks or
 * redirect/verify failures. Does not read Supabase "webhook logs" — we don't store them.
 */
export async function GET(request: Request) {
    const auth = await verifyAuth(request, { requireAdmin: true, requireFullStaff: true });
    if (!auth.authenticated) {
        return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 150, 1), 500);

    const { data: rows, error } = await supabaseAdmin
        .from('orders')
        .select('id, order_number, total, payment_status, payment_method, created_at, email, metadata')
        .neq('payment_status', 'paid')
        .eq('payment_method', 'moolre')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[reconcile-payments]', error);
        return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
    }

    const orders = (rows || []).filter((row: ReconcileRow) => {
        const ref = row.metadata?.moolre_externalref;
        return typeof ref === 'string' && ref.trim().length > 0;
    });

    return NextResponse.json({
        orders: orders.map((o: ReconcileRow) => ({
            id: o.id,
            order_number: o.order_number,
            total: o.total,
            payment_status: o.payment_status,
            created_at: o.created_at,
            email: o.email,
            moolre_externalref: o.metadata?.moolre_externalref ?? null,
            moolre_reference: o.metadata?.moolre_reference ?? null
        })),
        count: orders.length,
        note:
            'Orders where a Moolre link was created but the order is still not paid. Confirm amounts in the Moolre dashboard, then open the order and use Mark as paid if the payment succeeded.'
    });
}
