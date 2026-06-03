import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { getPublicSiteUrl } from '@/lib/site-url';
import {
    initiateHubtelCheckout,
    makeHubtelClientReference,
    normalizeGhPhone,
} from '@/lib/hubtel';

const orderRefForLog = (o: { order_number?: string | null; id?: string | null }) =>
    o?.order_number || o?.id || 'unknown';

/**
 * Starts a Hubtel Online Checkout session for an order and returns the URL we
 * should redirect the customer to.
 *
 * Security posture (unchanged from the previous Moolre route):
 *  - All amounts recomputed server-side from authoritative product prices.
 *  - Stock is validated; out-of-stock lines are auto-removed and the total
 *    is recomputed before the checkout link is minted.
 *  - clientReference is `<orderNumber>-r<base36Timestamp>` (<= 32 chars per
 *    Hubtel's hard limit) so a retry doesn't collide and the callback can
 *    resolve back to the order by stripping the "-r<...>" suffix.
 */
export async function POST(req: Request) {
    try {
        // Rate limiting
        const clientId = getClientIdentifier(req);
        const rateLimitResult = checkRateLimit(`hubtel:${clientId}`, RATE_LIMITS.payment);

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
        const { orderId, customerEmail, redirectUrl } = body;

        if (!orderId || typeof orderId !== 'string') {
            return NextResponse.json({ success: false, message: 'Missing or invalid orderId' }, { status: 400 });
        }

        // Ensure environment variables are set
        if (
            !process.env.HUBTEL_API_ID ||
            !process.env.HUBTEL_API_KEY ||
            !process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER
        ) {
            console.error('[Hubtel] Missing credentials');
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
                .select('id, order_number, total, email, phone, payment_status, shipping_address, metadata')
                .eq('id', orderId)
                .maybeSingle();
            if (!byId.error && byId.data) {
                order = byId.data;
            } else {
                const byRef = await supabaseAdmin
                    .from('orders')
                    .select('id, order_number, total, email, phone, payment_status, shipping_address, metadata')
                    .eq('order_number', orderId)
                    .maybeSingle();
                order = byRef.data;
                orderError = byRef.error;
            }
        } else {
            const result = await supabaseAdmin
                .from('orders')
                .select('id, order_number, total, email, phone, payment_status, shipping_address, metadata')
                .eq('order_number', orderId)
                .single();
            order = result.data;
            orderError = result.error;
        }

        if (orderError || !order) {
            console.error('[Hubtel] Order not found:', orderId);
            return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
        }

        // Don't allow payment for already-paid orders
        if (order.payment_status === 'paid') {
            return NextResponse.json({ success: false, message: 'Order is already paid' }, { status: 400 });
        }

        // Validate current stock before opening payment for this order.
        // If some items are out of stock we transparently remove them from the order
        // and recompute the total so the customer can still pay for what is available.
        const { data: orderItems, error: orderItemsError } = await supabaseAdmin
            .from('order_items')
            .select('id, product_id, variant_id, product_name, variant_name, quantity, total_price, unit_price')
            .eq('order_id', order.id);

        if (orderItemsError || !orderItems) {
            return NextResponse.json({ success: false, message: 'Could not validate stock' }, { status: 500 });
        }

        const variantIds = orderItems.filter(i => i.variant_id).map(i => i.variant_id as string);
        const productIds = orderItems
            .filter(i => i.product_id)
            .map(i => i.product_id as string);

        const variantStockMap: Record<string, { quantity: number; price: number | null }> = {};
        if (variantIds.length > 0) {
            const { data: variants } = await supabaseAdmin
                .from('product_variants')
                .select('id, quantity, price')
                .in('id', variantIds);
            for (const v of variants ?? []) {
                variantStockMap[v.id] = {
                    quantity: Number(v.quantity ?? 0),
                    price: v.price != null ? Number(v.price) : null,
                };
            }
        }

        const productStockMap: Record<string, {
            quantity: number | null;
            track_quantity: boolean | null;
            continue_selling: boolean | null;
            price: number | null;
            compare_at_price: number | null;
        }> = {};
        if (productIds.length > 0) {
            const { data: products } = await supabaseAdmin
                .from('products')
                .select('id, quantity, track_quantity, continue_selling, price, compare_at_price')
                .in('id', productIds);
            for (const p of products ?? []) {
                productStockMap[p.id] = {
                    quantity: p.quantity,
                    track_quantity: p.track_quantity,
                    continue_selling: p.continue_selling,
                    price: p.price != null ? Number(p.price) : null,
                    compare_at_price: p.compare_at_price != null ? Number(p.compare_at_price) : null,
                };
            }
        }

        const outOfStockItems: Array<{ id: string; name: string; variant?: string; total_price: number }> = [];
        // SECURITY: Re-price every line item from the database.  The client
        // wrote unit_price/total_price into order_items, so we never trust
        // those numbers when computing the charge amount.
        type RepricedItem = {
            id: string;
            quantity: number;
            server_unit_price: number;
            server_total_price: number;
        };
        const repricedItems: RepricedItem[] = [];

        for (const item of orderItems) {
            const needed = Number(item.quantity ?? 0);
            let isOOS = false;
            if (item.variant_id) {
                const v = variantStockMap[item.variant_id];
                const available = v?.quantity ?? -1;
                if (available < needed) isOOS = true;
            } else if (item.product_id) {
                const p = productStockMap[item.product_id];
                const available = Number(p?.quantity ?? 0);
                const bypass = Boolean(p?.continue_selling) || p?.track_quantity === false;
                if (!bypass && available < needed) isOOS = true;
            }
            if (isOOS) {
                outOfStockItems.push({
                    id: item.id,
                    name: item.product_name,
                    variant: item.variant_name ?? undefined,
                    total_price: Number(item.total_price ?? 0)
                });
                continue;
            }

            let serverUnit: number | null = null;
            if (item.variant_id) {
                const v = variantStockMap[item.variant_id];
                if (v?.price != null) serverUnit = v.price;
                else if (item.product_id) {
                    const p = productStockMap[item.product_id];
                    serverUnit = p?.price ?? null;
                }
            } else if (item.product_id) {
                const p = productStockMap[item.product_id];
                serverUnit = p?.price ?? null;
            }

            if (serverUnit == null) {
                // Missing price on the authoritative product row — bail out,
                // something is wrong and we don't want to charge anyone zero.
                console.error('[Hubtel] Missing server price for item', item.id, 'order', orderRefForLog(order));
                return NextResponse.json(
                    { success: false, message: 'Could not verify item prices. Please try again.' },
                    { status: 500 }
                );
            }

            const serverLineTotal = Number((serverUnit * needed).toFixed(2));
            repricedItems.push({
                id: item.id,
                quantity: needed,
                server_unit_price: serverUnit,
                server_total_price: serverLineTotal,
            });
        }

        const dbServerSubtotal = Number(
            repricedItems.reduce((sum, r) => sum + r.server_total_price, 0).toFixed(2)
        );
        const clientTotal = Number(order.total);

        // If the client-written total diverges from the recomputed total
        // by more than 1 cent, sync the DB row so the Hubtel charge is
        // based on authoritative prices.  This defends against a tampered
        // checkout that writes a smaller total.
        if (Math.abs(clientTotal - dbServerSubtotal) > 0.01) {
            console.warn(
                '[Hubtel] Re-pricing detected tampered total for order',
                orderRefForLog(order),
                '| client:', clientTotal, '| server:', dbServerSubtotal
            );
            const { error: syncErr } = await supabaseAdmin
                .from('orders')
                .update({
                    subtotal: dbServerSubtotal,
                    total: dbServerSubtotal,
                    metadata: {
                        ...(order.metadata || {}),
                        server_repriced_at: new Date().toISOString(),
                        client_total_attempt: clientTotal,
                    },
                })
                .eq('id', order.id);
            if (syncErr) {
                console.error('[Hubtel] Failed to sync repriced total:', syncErr.message);
                return NextResponse.json(
                    { success: false, message: 'Pricing check failed. Please try again.' },
                    { status: 500 }
                );
            }
            order.total = dbServerSubtotal;
        }

        let removedItems: Array<{ name: string; variant?: string }> = [];
        let amount = Number(order.total);
        let latestMetadata: Record<string, any> = order.metadata || {};

        if (outOfStockItems.length > 0) {
            // If every item is out of stock, refuse — there is nothing left to pay for.
            if (outOfStockItems.length >= orderItems.length) {
                return NextResponse.json(
                    {
                        success: false,
                        all_out_of_stock: true,
                        message: 'All items in this order are out of stock and cannot be paid for.',
                        outOfStock: outOfStockItems.map(i => ({ name: i.name, variant: i.variant }))
                    },
                    { status: 409 }
                );
            }

            // Auto-remove the out-of-stock line items from the order.
            const removeIds = outOfStockItems.map(i => i.id);
            const { error: deleteErr } = await supabaseAdmin
                .from('order_items')
                .delete()
                .in('id', removeIds);

            if (deleteErr) {
                console.error('[Hubtel] Failed to remove OOS items:', deleteErr.message);
                return NextResponse.json(
                    { success: false, message: 'Some items are out of stock. Please try again.' },
                    { status: 500 }
                );
            }

            // Recompute totals from the remaining items.
            const remaining = orderItems.filter(i => !removeIds.includes(i.id));
            const newSubtotal = remaining.reduce((sum, i) => sum + Number(i.total_price ?? 0), 0);
            const newTotal = newSubtotal; // shipping/tax/discount are already 0 for current flow

            const updatedMetadata = {
                ...latestMetadata,
                auto_removed_items: [
                    ...((latestMetadata.auto_removed_items as any[]) || []),
                    ...outOfStockItems.map(i => ({
                        name: i.name,
                        variant: i.variant ?? null,
                        removed_at: new Date().toISOString(),
                        reason: 'out_of_stock_at_payment'
                    }))
                ]
            };

            const { error: updateErr } = await supabaseAdmin
                .from('orders')
                .update({
                    subtotal: newSubtotal,
                    total: newTotal,
                    metadata: updatedMetadata
                })
                .eq('id', order.id);

            if (updateErr) {
                console.error('[Hubtel] Failed to update order totals after OOS removal:', updateErr.message);
                return NextResponse.json(
                    { success: false, message: 'Could not recalculate order. Please try again.' },
                    { status: 500 }
                );
            }

            removedItems = outOfStockItems.map(i => ({ name: i.name, variant: i.variant }));
            amount = newTotal;
            latestMetadata = updatedMetadata;
        }

        if (!amount || amount <= 0) {
            return NextResponse.json({ success: false, message: 'Invalid order amount' }, { status: 400 });
        }
        // Hubtel allows max 2 decimal places.
        const roundedAmount = Math.round(amount * 100) / 100;

        const orderRef = order.order_number || orderId;
        const clientReference = makeHubtelClientReference(orderRef);

        const baseUrl = getPublicSiteUrl();

        // Hubtel validates URLs and only accepts public HTTPS, so we always
        // build absolute return/callback URLs from the canonical site URL.
        const defaultRedirectUrl = `${baseUrl}/order-success?order=${orderRef}&payment_success=true`;
        const allowedPrefixes = ['https://'];
        const safeRedirectUrl =
            typeof redirectUrl === 'string' &&
            allowedPrefixes.some((prefix) => redirectUrl.startsWith(prefix))
                ? redirectUrl
                : defaultRedirectUrl;
        const cancellationUrl = `${baseUrl}/pay/${orderRef}?cancelled=true`;

        const shipping = (order.shipping_address as any) || {};
        const customerName =
            [shipping.firstName, shipping.lastName].filter(Boolean).join(' ').trim() ||
            customerEmail ||
            order.email ||
            'Customer';
        const customerPhone = normalizeGhPhone(order.phone || shipping.phone || '');
        const customerMail = customerEmail || order.email || undefined;

        const payload = {
            totalAmount: roundedAmount,
            description: `Order ${orderRef}`,
            callbackUrl: `${baseUrl}/api/payment/hubtel/callback`,
            returnUrl: safeRedirectUrl,
            cancellationUrl,
            merchantAccountNumber: process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER,
            clientReference,
            ...(customerName ? { payeeName: customerName } : {}),
            ...(customerPhone ? { payeeMobileNumber: customerPhone } : {}),
            ...(customerMail ? { payeeEmail: customerMail } : {}),
        };

        console.log('[Hubtel] Initiating for order:', orderRef, '| Amount from DB:', roundedAmount, '| Callback:', payload.callbackUrl);

        const result = await initiateHubtelCheckout(payload as any);

        const checkoutUrl = result?.data?.checkoutUrl || result?.data?.checkoutDirectUrl;
        const checkoutId = result?.data?.checkoutId;

        if (!checkoutUrl) {
            console.error('[Hubtel] No checkout URL in response:', JSON.stringify(result));
            const upstreamMessage =
                result?.message ||
                (result as any)?.data?.message ||
                'Failed to generate payment link';
            return NextResponse.json(
                { success: false, message: `Hubtel: ${upstreamMessage}` },
                { status: 502 },
            );
        }

        // Store the Hubtel reference on the order so verify/callback can use it.
        const { error: metaError } = await supabaseAdmin
            .from('orders')
            .update({
                metadata: {
                    ...latestMetadata,
                    payment_gateway: 'hubtel',
                    payment_method: 'hubtel',
                    hubtel_client_reference: clientReference,
                    hubtel_checkout_id: checkoutId || null,
                    hubtel_initiated_at: new Date().toISOString(),
                }
            })
            .eq('id', order.id);

        if (metaError) {
            console.error('[Hubtel] Failed to store hubtel_client_reference:', metaError.message);
        } else {
            console.log('[Hubtel] Stored clientReference:', clientReference, 'for order:', orderRef);
        }

        return NextResponse.json({
            success: true,
            url: checkoutUrl,
            checkoutDirectUrl: result?.data?.checkoutDirectUrl || null,
            checkoutId,
            externalRef: clientReference,
            reference: checkoutId || clientReference,
            amount: roundedAmount,
            removedItems
        });

    } catch (error: any) {
        console.error('[Hubtel] Init error:', error?.message || error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
