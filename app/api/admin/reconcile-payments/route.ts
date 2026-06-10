import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import { sendOrderConfirmation, sendPosReceiptSmsByOrderRef, isPosSaleOrder } from '@/lib/notifications';
import { checkHubtelStatus, isHubtelPaid } from '@/lib/hubtel';
import { recordAffiliateCommission } from '@/lib/affiliate-server';

type ReconcileRow = {
    id: string;
    order_number: string | null;
    total: number | null;
    payment_status: string | null;
    payment_method: string | null;
    created_at: string | null;
    email: string | null;
    metadata: Record<string, any> | null;
};

/**
 * Lists Hubtel orders where a checkout was initiated (metadata.hubtel_client_reference)
 * but payment_status is not "paid". These are candidates for missed callbacks or
 * redirect/verify failures.
 *
 * Legacy Moolre orders (metadata.moolre_externalref) are also surfaced so older
 * stuck orders remain visible after the gateway switch.
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
        .in('payment_method', ['hubtel', 'moolre'])
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[reconcile-payments]', error);
        return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
    }

    const orders = (rows || []).filter((row: ReconcileRow) => {
        const hubtelRef = row.metadata?.hubtel_client_reference;
        const moolreRef = row.metadata?.moolre_externalref;
        return (
            (typeof hubtelRef === 'string' && hubtelRef.trim().length > 0) ||
            (typeof moolreRef === 'string' && moolreRef.trim().length > 0)
        );
    });

    return NextResponse.json({
        orders: orders.map((o: ReconcileRow) => ({
            id: o.id,
            order_number: o.order_number,
            total: o.total,
            payment_status: o.payment_status,
            payment_method: o.payment_method,
            created_at: o.created_at,
            email: o.email,
            hubtel_client_reference: o.metadata?.hubtel_client_reference ?? null,
            hubtel_checkout_id: o.metadata?.hubtel_checkout_id ?? null,
            moolre_externalref: o.metadata?.moolre_externalref ?? null,
            moolre_reference: o.metadata?.moolre_reference ?? null,
        })),
        count: orders.length,
        note:
            'Orders where a payment link was created but the order is still not paid. For Hubtel orders, use "Re-verify" to re-query Hubtel and auto-mark paid if the payment succeeded. Legacy Moolre orders must be confirmed in the Moolre dashboard, then marked paid manually.',
    });
}

/**
 * Actively re-reconciles a single Hubtel order by re-querying Hubtel's status
 * endpoint with the stored clientReference. Marks the order paid only if Hubtel
 * confirms "Paid" AND the settlement amount matches the order total.
 */
export async function POST(request: Request) {
    const auth = await verifyAuth(request, { requireAdmin: true, requireFullStaff: true });
    if (!auth.authenticated) {
        return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    let body: any = {};
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const orderId = body?.orderId;
    if (!orderId || typeof orderId !== 'string') {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    if (
        !process.env.HUBTEL_API_ID ||
        !process.env.HUBTEL_API_KEY ||
        !process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER
    ) {
        return NextResponse.json({ error: 'Hubtel is not configured' }, { status: 503 });
    }

    const { data: order, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('id, order_number, payment_status, total, email, metadata')
        .eq('id', orderId)
        .maybeSingle();

    if (fetchError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.payment_status === 'paid') {
        return NextResponse.json({ success: true, payment_status: 'paid', message: 'Order already paid' });
    }

    const clientReference = (order.metadata as any)?.hubtel_client_reference as string | undefined;
    if (!clientReference) {
        return NextResponse.json({ error: 'No Hubtel reference on this order' }, { status: 400 });
    }

    const expectedAmount = Number(order.total) || 0;

    let verified = false;
    let settlementAmount: number | null = null;
    try {
        const status = await checkHubtelStatus(clientReference);
        verified = isHubtelPaid(String(status?.data?.status || ''), status?.responseCode);
        const settlement = status?.data?.amountAfterCharges ?? status?.data?.amount;
        if (settlement !== undefined && settlement !== null) {
            const n = parseFloat(String(settlement));
            if (Number.isFinite(n)) settlementAmount = n;
        }
    } catch (e: any) {
        console.error('[reconcile-payments] Hubtel status failed:', e?.message || e);
        return NextResponse.json({ error: 'Could not reach Hubtel' }, { status: 502 });
    }

    if (verified && settlementAmount !== null && Math.abs(settlementAmount - expectedAmount) > 0.01) {
        return NextResponse.json({
            success: false,
            payment_status: order.payment_status,
            message: `Hubtel reports Paid but amount mismatch (expected ${expectedAmount}, got ${settlementAmount}). Not marking paid.`,
        });
    }

    if (!verified) {
        return NextResponse.json({
            success: false,
            payment_status: order.payment_status,
            message: 'Hubtel has not confirmed this payment as Paid yet.',
        });
    }

    const { data: orderJson, error: updateError } = await supabaseAdmin.rpc('mark_order_paid', {
        order_ref: order.order_number,
        moolre_ref: (order.metadata as any)?.hubtel_checkout_id || 'hubtel-reconcile',
    });

    if (updateError) {
        console.error('[reconcile-payments] RPC error:', updateError.message);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    if (orderJson?.email) {
        try {
            await supabaseAdmin.rpc('update_customer_stats', {
                p_customer_email: orderJson.email,
                p_order_total: orderJson.total,
            });
        } catch (e: any) {
            console.error('[reconcile-payments] Customer stats failed:', e?.message || e);
        }
    }

    if (orderJson) {
        try {
            await sendOrderConfirmation(orderJson);
            if (isPosSaleOrder(orderJson.metadata) && orderJson.order_number) {
                await sendPosReceiptSmsByOrderRef(orderJson.order_number);
            }
        } catch (e: any) {
            console.error('[reconcile-payments] Notification failed:', e?.message || e);
        }
    }

    // Record affiliate commission (best-effort, idempotent).
    if (order.order_number) {
        await recordAffiliateCommission(order.order_number);
    }

    return NextResponse.json({
        success: true,
        payment_status: 'paid',
        message: 'Hubtel confirmed payment — order marked paid.',
    });
}
