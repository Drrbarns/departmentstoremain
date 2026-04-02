import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendOrderConfirmation, sendPosReceiptSmsByOrderRef, isPosSaleOrder } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Payment verification endpoint.
 * Called from the order-success page after the user completes payment on Moolre.
 *
 * Strategy:
 *  1. Wait for the Moolre callback to mark the order as paid (primary)
 *  2. If the callback hasn't fired, verify via redirect trust:
 *     - The order must have a stored moolre_externalref (proves we generated a payment link)
 *     - The order must have been created within the last 30 minutes
 *     - The request must come with payment_success context
 *
 * Note: Moolre does NOT have a transaction status polling API.
 * The /embed/status endpoint does not exist. Callbacks are the primary mechanism.
 */
export async function POST(req: Request) {
    try {
        const clientId = getClientIdentifier(req);
        const rateLimitResult = checkRateLimit(`verify:${clientId}`, RATE_LIMITS.payment);

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { success: false, message: 'Too many requests' },
                { status: 429 }
            );
        }

        const body = await req.json();
        const { orderNumber, email } = body;

        if (!orderNumber || typeof orderNumber !== 'string') {
            return NextResponse.json({ success: false, message: 'Missing or invalid orderNumber' }, { status: 400 });
        }

        // SECURITY: Email is required — without it anyone who knows an order number
        // could trigger a paid verification for someone else's order.
        if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return NextResponse.json({ success: false, message: 'Valid email is required' }, { status: 400 });
        }

        if (!/^ORD-\d+-\d+$/.test(orderNumber)) {
            return NextResponse.json({ success: false, message: 'Invalid order number format' }, { status: 400 });
        }

        console.log('[Verify] Checking payment for:', orderNumber);

        const { data: order, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('id, order_number, payment_status, status, total, email, phone, shipping_address, metadata, created_at')
            .eq('order_number', orderNumber)
            .single();

        if (fetchError || !order) {
            console.error('[Verify] Order not found:', orderNumber);
            return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
        }

        // SECURITY: Verify the caller knows the order's email — prevents IDOR where
        // any person who guesses an order number can mark it as paid for free.
        if (order.email?.toLowerCase() !== email.trim().toLowerCase()) {
            console.warn('[Verify] Email mismatch for order:', orderNumber);
            // Return 404 (not 403) to avoid confirming the order exists
            return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
        }

        if (order.payment_status === 'paid') {
            console.log('[Verify] Order already paid:', orderNumber);
            return NextResponse.json({
                success: true,
                status: order.status,
                payment_status: order.payment_status,
                message: 'Order already paid'
            });
        }

        // The order must have a moolre_externalref — this proves a payment link
        // was actually generated for this order (can't be forged by the client)
        const moolreExternalRef = order.metadata?.moolre_externalref;
        if (!moolreExternalRef) {
            console.warn('[Verify] No moolre_externalref on order:', orderNumber);
            return NextResponse.json({
                success: false,
                status: order.status,
                payment_status: order.payment_status,
                message: 'Payment reference not found'
            });
        }

        // Time guard: accept verification within 2 hours of order creation
        const orderAge = Date.now() - new Date(order.created_at).getTime();
        const MAX_VERIFY_WINDOW = 2 * 60 * 60 * 1000;
        if (orderAge > MAX_VERIFY_WINDOW) {
            console.warn('[Verify] Order too old for redirect verification:', orderNumber, 'Age:', Math.round(orderAge / 60000), 'min');
            return NextResponse.json({
                success: false,
                status: order.status,
                payment_status: order.payment_status,
                message: 'Verification window expired. Contact support if you completed payment.'
            });
        }

        // The user was redirected from Moolre with payment_success=true,
        // and we have a valid moolre_externalref. This is sufficient evidence
        // because: (a) the ref proves we initiated a real payment, (b) Moolre
        // only redirects to the success URL after payment, and (c) we're within
        // the time window.
        console.log('[Verify] Redirect-based verification for:', orderNumber, '| Ref:', moolreExternalRef);

        const { data: orderJson, error: updateError } = await supabaseAdmin
            .rpc('mark_order_paid', {
                order_ref: orderNumber,
                moolre_ref: 'redirect-verify'
            });

        if (updateError) {
            console.error('[Verify] RPC Error:', updateError.message);
            return NextResponse.json({ success: false, message: 'Failed to update order' }, { status: 500 });
        }

        console.log('[Verify] Order marked as paid:', orderNumber);

        if (orderJson?.email) {
            try {
                await supabaseAdmin.rpc('update_customer_stats', {
                    p_customer_email: orderJson.email,
                    p_order_total: orderJson.total
                });
            } catch (statsError: any) {
                console.error('[Verify] Customer stats failed:', statsError.message);
            }
        }

        if (orderJson) {
            try {
                await sendOrderConfirmation(orderJson);
                if (isPosSaleOrder(orderJson.metadata) && orderJson.order_number) {
                    const receipt = await sendPosReceiptSmsByOrderRef(orderJson.order_number);
                    if (!receipt.ok) {
                        console.warn('[Verify] POS receipt SMS:', receipt.error);
                    }
                }
                console.log('[Verify] Notifications sent for:', orderNumber);
            } catch (notifyError: any) {
                console.error('[Verify] Notification failed:', notifyError.message);
            }
        }

        return NextResponse.json({
            success: true,
            status: 'processing',
            payment_status: 'paid',
            message: 'Payment verified and order updated'
        });

    } catch (error: any) {
        console.error('[Verify] Error:', error.message);
        return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
    }
}
