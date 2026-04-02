import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(req: Request) {
    try {
        // Rate limiting
        const clientId = getClientIdentifier(req);
        const rateLimitResult = checkRateLimit(`payment:${clientId}`, RATE_LIMITS.payment);

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { success: false, message: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': rateLimitResult.resetIn.toString()
                    }
                }
            );
        }

        const body = await req.json();
        const { orderId, customerEmail } = body;

        if (!orderId || typeof orderId !== 'string') {
            return NextResponse.json({ success: false, message: 'Missing or invalid orderId' }, { status: 400 });
        }

        // Ensure environment variables are set
        if (!process.env.MOOLRE_API_USER || !process.env.MOOLRE_API_PUBKEY || !process.env.MOOLRE_ACCOUNT_NUMBER) {
            console.error('Missing Moolre credentials');
            return NextResponse.json({ success: false, message: 'Payment gateway configuration error' }, { status: 500 });
        }

        // SECURITY: Fetch the order from the database and use its total.
        // NEVER trust the amount from the client.
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);

        // SECURITY: Use parameterized .eq() calls instead of string interpolation in .or()
        // to avoid any risk of PostgREST filter injection.
        let order: any = null;
        let orderError: any = null;

        if (isUUID) {
            // Try by UUID first, then by order_number (order_number could also look like a UUID)
            const byId = await supabaseAdmin
                .from('orders')
                .select('id, order_number, total, email, payment_status, metadata')
                .eq('id', orderId)
                .maybeSingle();
            if (!byId.error && byId.data) {
                order = byId.data;
            } else {
                const byRef = await supabaseAdmin
                    .from('orders')
                    .select('id, order_number, total, email, payment_status, metadata')
                    .eq('order_number', orderId)
                    .maybeSingle();
                order = byRef.data;
                orderError = byRef.error;
            }
        } else {
            const result = await supabaseAdmin
                .from('orders')
                .select('id, order_number, total, email, payment_status, metadata')
                .eq('order_number', orderId)
                .single();
            order = result.data;
            orderError = result.error;
        }

        if (orderError || !order) {
            console.error('[Payment] Order not found:', orderId);
            return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
        }

        // Don't allow payment for already-paid orders
        if (order.payment_status === 'paid') {
            return NextResponse.json({ success: false, message: 'Order is already paid' }, { status: 400 });
        }

        // Use the database amount, NOT the client-provided amount
        const amount = Number(order.total);
        if (!amount || amount <= 0) {
            return NextResponse.json({ success: false, message: 'Invalid order amount' }, { status: 400 });
        }

        const orderRef = order.order_number || orderId;

        const { getPublicSiteUrl } = await import('@/lib/site-url');
        const baseUrl = getPublicSiteUrl();

        // Generate a unique external reference for Moolre
        const uniqueRef = `${orderRef}-R${Date.now()}`;

        // Moolre Payload
        const payload = {
            type: 1,
            amount: amount.toString(),
            email: process.env.MOOLRE_MERCHANT_EMAIL || 'admin@standardecom.com',
            externalref: uniqueRef,
            callback: `${baseUrl}/api/payment/moolre/callback`,
            redirect: `${baseUrl}/order-success?order=${orderRef}&payment_success=true`,
            reusable: "0",
            currency: "GHS",
            accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
            metadata: {
                customer_email: customerEmail || order.email,
                original_order_number: orderRef
            }
        };

        console.log('[Payment] Initiating for order:', orderRef, '| Amount from DB:', amount, '| Callback:', payload.callback);

        const response = await fetch('https://api.moolre.com/embed/link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-USER': process.env.MOOLRE_API_USER,
                'X-API-PUBKEY': process.env.MOOLRE_API_PUBKEY
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('[Payment] Response status:', result.status, '| Has URL:', !!result.data?.authorization_url);

        if (result.status === 1 && result.data?.authorization_url) {
            // Store the Moolre external reference on the order so verify/callback can use it
            const { error: metaError } = await supabaseAdmin
                .from('orders')
                .update({
                    metadata: {
                        ...(order.metadata || {}),
                        moolre_externalref: uniqueRef,
                        moolre_reference: result.data.reference || null
                    }
                })
                .eq('id', order.id);

            if (metaError) {
                console.error('[Payment] Failed to store moolre_externalref:', metaError.message);
            } else {
                console.log('[Payment] Stored externalref:', uniqueRef, 'for order:', orderRef);
            }

            return NextResponse.json({ success: true, url: result.data.authorization_url, reference: result.data.reference });
        } else {
            return NextResponse.json({ success: false, message: result.message || 'Failed to generate payment link' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Payment API Error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
