import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendOrderConfirmation, sendPosReceiptSmsByOrderRef, isPosSaleOrder } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { checkHubtelStatus, isHubtelPaid } from '@/lib/hubtel';
import { recordAffiliateCommission } from '@/lib/affiliate-server';

/**
 * Server-side Hubtel verification, called from /order-success after the
 * customer returns from the hosted checkout.
 *
 * Unlike Moolre (which had no status API and relied on redirect-trust), Hubtel
 * exposes an RMSC status endpoint, so here we actually re-query Hubtel using
 * the clientReference we stored at initiation time and only mark the order
 * paid when Hubtel confirms "Paid" AND the settlement amount matches the order
 * total. We keep the same IDOR/same-origin guards as the old Moolre verify.
 */
export async function POST(req: Request) {
    try {
        const clientId = getClientIdentifier(req);
        const rateLimitResult = checkRateLimit(`hubtel-verify:${clientId}`, RATE_LIMITS.payment);
        if (!rateLimitResult.success) {
            return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
        }

        // SECURITY: Require same-origin request so a leaked (order_number, email)
        // pair can't be abused cross-site or by a script on another domain.
        const origin = req.headers.get('origin') || '';
        const host = req.headers.get('host') || '';
        const allowedOrigins = [
            process.env.NEXT_PUBLIC_APP_URL,
            process.env.NEXT_PUBLIC_SITE_URL,
            host ? `https://${host}` : null,
            host ? `http://${host}` : null,
        ].filter(Boolean) as string[];
        if (origin && !allowedOrigins.some((o) => origin === o)) {
            console.warn('[Hubtel Verify] Rejected cross-origin request from:', origin);
            return NextResponse.json({ success: false, message: 'Cross-origin requests not allowed' }, { status: 403 });
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

        console.log('[Hubtel Verify] Checking payment for:', orderNumber);

        const { data: order, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('id, order_number, payment_status, status, total, email, phone, shipping_address, metadata, created_at')
            .eq('order_number', orderNumber)
            .single();

        if (fetchError || !order) {
            console.error('[Hubtel Verify] Order not found:', orderNumber);
            return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
        }

        // SECURITY: Verify the caller knows the order's email — prevents IDOR where
        // any person who guesses an order number can mark it as paid for free.
        if (order.email?.toLowerCase() !== email.trim().toLowerCase()) {
            console.warn('[Hubtel Verify] Email mismatch for order:', orderNumber);
            // Return 404 (not 403) to avoid confirming the order exists
            return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
        }

        if (order.payment_status === 'paid') {
            console.log('[Hubtel Verify] Order already paid:', orderNumber);
            return NextResponse.json({
                success: true,
                status: order.status,
                payment_status: order.payment_status,
                message: 'Order already paid',
            });
        }

        // The order must carry a hubtel_client_reference — this proves a Hubtel
        // checkout was actually initiated for it (can't be forged by the client).
        const clientReference = (order.metadata as any)?.hubtel_client_reference as string | undefined;
        if (!clientReference) {
            console.warn('[Hubtel Verify] No hubtel_client_reference on order:', orderNumber);
            return NextResponse.json({
                success: false,
                status: order.status,
                payment_status: order.payment_status,
                message: 'Payment reference not found',
            });
        }

        if (
            !process.env.HUBTEL_API_ID ||
            !process.env.HUBTEL_API_KEY ||
            !process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER
        ) {
            return NextResponse.json(
                {
                    success: false,
                    status: order.status,
                    payment_status: order.payment_status,
                    message: 'Payment verification unavailable',
                },
                { status: 503 },
            );
        }

        const expectedAmount = Number(order.total) || 0;

        let verified = false;
        let settlementAmount: number | null = null;
        try {
            const status = await checkHubtelStatus(clientReference);
            const sStatus = String(status?.data?.status || '').toLowerCase();
            verified = isHubtelPaid(sStatus, status?.responseCode);
            const settlement = status?.data?.amountAfterCharges ?? status?.data?.amount;
            if (settlement !== undefined && settlement !== null) {
                const n = parseFloat(String(settlement));
                if (Number.isFinite(n)) settlementAmount = n;
            }
            console.log(
                '[Hubtel Verify] ref:',
                clientReference,
                '| status:',
                status?.data?.status,
                '| amount:',
                status?.data?.amount,
                '| amountAfterCharges:',
                status?.data?.amountAfterCharges,
                '| expected:',
                expectedAmount,
            );
        } catch (e: any) {
            console.warn('[Hubtel Verify] Status API failed:', e?.message || e);
        }

        if (verified && settlementAmount !== null && Math.abs(settlementAmount - expectedAmount) > 0.01) {
            console.error(
                '[Hubtel Verify] AMOUNT MISMATCH. Expected:',
                expectedAmount,
                'Got (settlement):',
                settlementAmount,
            );
            verified = false;
        }

        if (!verified) {
            return NextResponse.json({
                success: false,
                status: order.status,
                payment_status: order.payment_status,
                message: 'Payment not yet confirmed by payment provider',
            });
        }

        const { data: orderJson, error: updateError } = await supabaseAdmin.rpc('mark_order_paid', {
            order_ref: orderNumber,
            moolre_ref: 'hubtel-api-verify',
        });

        if (updateError) {
            console.error('[Hubtel Verify] RPC Error:', updateError.message);
            return NextResponse.json({ success: false, message: 'Failed to update order' }, { status: 500 });
        }

        console.log('[Hubtel Verify] Order marked as paid:', orderNumber);

        if (orderJson?.email) {
            try {
                await supabaseAdmin.rpc('update_customer_stats', {
                    p_customer_email: orderJson.email,
                    p_order_total: orderJson.total,
                });
            } catch (statsError: any) {
                console.error('[Hubtel Verify] Customer stats failed:', statsError.message);
            }
        }

        if (orderJson) {
            try {
                await sendOrderConfirmation(orderJson);
                if (isPosSaleOrder(orderJson.metadata) && orderJson.order_number) {
                    const receipt = await sendPosReceiptSmsByOrderRef(orderJson.order_number);
                    if (!receipt.ok) {
                        console.warn('[Hubtel Verify] POS receipt SMS:', receipt.error);
                    }
                }
            } catch (notifyError: any) {
                console.error('[Hubtel Verify] Notification failed:', notifyError.message);
            }
        }

        // Record affiliate commission (best-effort, idempotent — webhook may also fire).
        await recordAffiliateCommission(orderNumber);

        return NextResponse.json({
            success: true,
            status: 'processing',
            payment_status: 'paid',
            message: 'Payment verified and order updated',
        });
    } catch (error: any) {
        console.error('[Hubtel Verify] Error:', error?.message || error);
        return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
    }
}
