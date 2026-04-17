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

        // Validate current stock before opening payment for this order.
        // If some items are out of stock we transparently remove them from the order
        // and recompute the total so the customer can still pay for what is available.
        const { data: orderItems, error: orderItemsError } = await supabaseAdmin
            .from('order_items')
            .select('id, product_id, variant_id, product_name, variant_name, quantity, total_price')
            .eq('order_id', order.id);

        if (orderItemsError || !orderItems) {
            return NextResponse.json({ success: false, message: 'Could not validate stock' }, { status: 500 });
        }

        const variantIds = orderItems.filter(i => i.variant_id).map(i => i.variant_id as string);
        const productIds = orderItems.filter(i => !i.variant_id && i.product_id).map(i => i.product_id as string);

        const variantStockMap: Record<string, number> = {};
        if (variantIds.length > 0) {
            const { data: variants } = await supabaseAdmin
                .from('product_variants')
                .select('id, quantity')
                .in('id', variantIds);
            for (const v of variants ?? []) variantStockMap[v.id] = Number(v.quantity ?? 0);
        }

        const productStockMap: Record<string, { quantity: number | null; track_quantity: boolean | null; continue_selling: boolean | null; }> = {};
        if (productIds.length > 0) {
            const { data: products } = await supabaseAdmin
                .from('products')
                .select('id, quantity, track_quantity, continue_selling')
                .in('id', productIds);
            for (const p of products ?? []) productStockMap[p.id] = p;
        }

        const outOfStockItems: Array<{ id: string; name: string; variant?: string; total_price: number }> = [];
        for (const item of orderItems) {
            const needed = Number(item.quantity ?? 0);
            let isOOS = false;
            if (item.variant_id) {
                const available = variantStockMap[item.variant_id] ?? -1;
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
            }
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
                console.error('[Payment] Failed to remove OOS items:', deleteErr.message);
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
                console.error('[Payment] Failed to update order totals after OOS removal:', updateErr.message);
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
                        ...latestMetadata,
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

            return NextResponse.json({
                success: true,
                url: result.data.authorization_url,
                reference: result.data.reference,
                amount,
                removedItems
            });
        } else {
            return NextResponse.json({ success: false, message: result.message || 'Failed to generate payment link' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Payment API Error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
