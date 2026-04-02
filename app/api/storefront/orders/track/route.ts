import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

const TRACK_RATE_LIMIT = { maxRequests: 10, windowSeconds: 60 };

export async function POST(request: Request) {
    try {
        // Rate limiting — strict, same as payment endpoints
        const clientId = getClientIdentifier(request);
        const rateLimitResult = checkRateLimit(`track:${clientId}`, TRACK_RATE_LIMIT);

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { status: 429, headers: { 'X-RateLimit-Reset': rateLimitResult.resetIn.toString() } }
            );
        }

        const body = await request.json();
        const { orderNumber, email } = body;

        if (!orderNumber || typeof orderNumber !== 'string') {
            return NextResponse.json({ error: 'Order number is required' }, { status: 400 });
        }
        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Validate formats before touching the DB
        if (!/^[A-Za-z0-9\-]{1,64}$/.test(orderNumber.trim())) {
            return NextResponse.json({ error: 'Invalid order number format' }, { status: 400 });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        // SECURITY: Server-side lookup via admin client — RLS does not apply
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                status,
                payment_status,
                total,
                email,
                created_at,
                shipping_address,
                metadata,
                order_items (
                    id,
                    product_name,
                    variant_name,
                    quantity,
                    unit_price,
                    metadata,
                    product_variants ( image_url ),
                    products (
                        product_images ( url )
                    )
                )
            `)
            .eq('order_number', orderNumber.trim())
            .single();

        // SECURITY: Return the same generic error whether the order doesn't exist
        // or the email doesn't match — prevents order number enumeration.
        if (orderError || !order) {
            return NextResponse.json(
                { error: 'Order not found or email does not match' },
                { status: 404 }
            );
        }

        // SECURITY: Email verified server-side — data is never returned without this check
        if (order.email?.toLowerCase() !== email.trim().toLowerCase()) {
            return NextResponse.json(
                { error: 'Order not found or email does not match' },
                { status: 404 }
            );
        }

        // Strip the email from the response — the client already knows it
        const { email: _email, ...safeOrder } = order;
        return NextResponse.json({ order: safeOrder });

    } catch (error: any) {
        console.error('[Track] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
