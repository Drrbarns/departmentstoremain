import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

const CREATE_RATE_LIMIT = { maxRequests: 12, windowSeconds: 60 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_NUMBER_RE = /^ORD-\d+-\d+$/;

interface IncomingItem {
    id: string; // product id or slug
    name?: string;
    variant?: string | null;
    variantId?: string | null;
    quantity: number;
    price: number; // marked-up unit price the customer pays
    basePrice?: number; // pre-markup unit price (for affiliate commission)
    image?: string | null;
    slug?: string | null;
}

interface AffiliateMeta {
    code: string;
    commission_pct: number;
    base_subtotal: number;
    commission_amount: number;
}

interface CreateOrderPayload {
    orderNumber: string;
    trackingNumber: string;
    userId?: string | null;
    email: string;
    phone: string;
    shippingData: Record<string, unknown> & {
        firstName?: string;
        lastName?: string;
        preferredDate?: string | null;
    };
    deliveryMethod: string;
    paymentMethod: string;
    currency: string;
    subtotal: number;
    tax: number;
    shippingCost: number;
    total: number;
    affiliate?: AffiliateMeta | null;
    items: IncomingItem[];
}

function badRequest(message: string, extra?: Record<string, unknown>) {
    return NextResponse.json({ error: message, ...(extra || {}) }, { status: 400 });
}

export async function POST(req: Request) {
    try {
        const clientId = getClientIdentifier(req);
        const rl = checkRateLimit(`orders-create:${clientId}`, CREATE_RATE_LIMIT);
        if (!rl.success) {
            return NextResponse.json({ error: 'Too many checkout attempts. Please wait a moment.' }, { status: 429 });
        }

        let body: CreateOrderPayload;
        try {
            body = (await req.json()) as CreateOrderPayload;
        } catch {
            return badRequest('Invalid JSON body');
        }

        // --- Basic validation ------------------------------------------------
        if (!body || typeof body !== 'object') return badRequest('Missing body');
        if (!body.orderNumber || !ORDER_NUMBER_RE.test(body.orderNumber)) {
            return badRequest('Invalid order number');
        }
        if (!body.email || !/^\S+@\S+\.\S+$/.test(body.email)) {
            return badRequest('Invalid email');
        }
        if (!body.phone || typeof body.phone !== 'string' || body.phone.length < 5) {
            return badRequest('Invalid phone');
        }
        if (!Array.isArray(body.items) || body.items.length === 0) {
            return badRequest('Cart is empty');
        }
        if (body.items.length > 200) {
            return badRequest('Too many items');
        }
        if (body.userId && !UUID_RE.test(body.userId)) {
            return badRequest('Invalid user id');
        }

        // --- Resolve items to real product ids ------------------------------
        const slugLookups = body.items.filter((i) => !UUID_RE.test(i.id));
        const directIds = body.items.filter((i) => UUID_RE.test(i.id)).map((i) => i.id);

        const productMetaMap = new Map<string, any>();
        const productStatusMap = new Map<string, string>(); // real uuid -> status

        if (directIds.length > 0) {
            const { data: prods } = await supabaseAdmin
                .from('products')
                .select('id, status, metadata')
                .in('id', directIds);
            (prods || []).forEach((p: any) => {
                productMetaMap.set(p.id, p.metadata);
                productStatusMap.set(p.id, p.status);
            });
        }

        const resolvedIds = new Map<string, string>(); // input -> real uuid
        for (const item of slugLookups) {
            const { data: prod } = await supabaseAdmin
                .from('products')
                .select('id, status, metadata')
                .or(`slug.eq.${item.id},id.eq.${item.id}`)
                .maybeSingle();
            if (!prod) {
                return badRequest(`Product not found: ${item.name || item.id}`);
            }
            resolvedIds.set(item.id, prod.id);
            productMetaMap.set(prod.id, (prod as any).metadata);
            productStatusMap.set(prod.id, (prod as any).status);
        }

        // --- Reject unavailable (draft / unknown) products ------------------
        // Only `active` products may be purchased. This is the authoritative
        // gate: it catches stale carts (product drafted after it was added),
        // direct API calls, and links to draft product pages.
        const unavailable: string[] = [];
        for (const item of body.items) {
            const productId = UUID_RE.test(item.id) ? item.id : resolvedIds.get(item.id);
            const status = productId ? productStatusMap.get(productId) : undefined;
            if (status !== 'active') {
                unavailable.push(item.name || item.id);
            }
        }
        if (unavailable.length > 0) {
            return badRequest(
                `Some items are no longer available and were removed: ${unavailable.join(', ')}. Please review your cart and try again.`,
                { unavailable }
            );
        }

        // --- Build the order row -------------------------------------------
        const preferredDate =
            typeof body.shippingData?.preferredDate === 'string' && body.shippingData.preferredDate.trim()
                ? body.shippingData.preferredDate.trim()
                : null;

        // Sanitize affiliate attribution (best-effort; commission is re-verified
        // server-side from the affiliate's locked-in % when the order is paid).
        const a = body.affiliate;
        const affiliateMeta =
            a && typeof a.code === 'string' && a.code.trim() && Number(a.commission_amount) > 0
                ? {
                      affiliate: {
                          code: a.code.trim(),
                          commission_pct: Number(a.commission_pct) || 0,
                          base_subtotal: Number(a.base_subtotal) || 0,
                          commission_amount: Number(a.commission_amount) || 0,
                      },
                  }
                : {};

        const orderRow = {
            order_number: body.orderNumber,
            user_id: body.userId || null,
            email: body.email,
            phone: body.phone,
            status: 'pending',
            payment_status: 'pending',
            currency: body.currency || 'GHS',
            subtotal: Number(body.subtotal) || 0,
            tax_total: Number(body.tax) || 0,
            shipping_total: Number(body.shippingCost) || 0,
            discount_total: 0,
            total: Number(body.total) || 0,
            shipping_method: body.deliveryMethod || null,
            payment_method: body.paymentMethod || null,
            shipping_address: body.shippingData,
            billing_address: body.shippingData,
            metadata: {
                guest_checkout: !body.userId,
                first_name: body.shippingData?.firstName || null,
                last_name: body.shippingData?.lastName || null,
                tracking_number: body.trackingNumber,
                ...(preferredDate ? { customer_preferred_date: preferredDate } : {}),
                ...affiliateMeta,
            },
        };

        // --- Insert order ---------------------------------------------------
        const { data: createdOrder, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert([orderRow])
            .select('id, order_number')
            .single();

        if (orderError || !createdOrder) {
            console.error('[OrdersCreate] order insert failed:', orderError);
            return NextResponse.json(
                { error: orderError?.message || 'Failed to create order' },
                { status: 500 }
            );
        }

        // --- Insert order_items --------------------------------------------
        const orderItems = body.items.map((item) => {
            const productId = UUID_RE.test(item.id) ? item.id : resolvedIds.get(item.id)!;
            const variantId =
                item.variantId && UUID_RE.test(item.variantId) ? item.variantId : null;
            const prodMeta = productMetaMap.get(productId);
            const unit = Number(item.price) || 0;
            const qty = Number(item.quantity) || 0;
            return {
                order_id: createdOrder.id,
                product_id: productId,
                variant_id: variantId,
                product_name: item.name || '',
                variant_name: item.variant || null,
                quantity: qty,
                unit_price: unit,
                total_price: unit * qty,
                metadata: {
                    image: item.image || null,
                    slug: item.slug || null,
                    base_unit_price: typeof item.basePrice === 'number' ? item.basePrice : unit,
                    preorder_shipping: prodMeta?.preorder_shipping || null,
                },
            };
        });

        const { error: itemsError } = await supabaseAdmin
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            // Compensating delete: don't leave an empty order row around.
            try {
                await supabaseAdmin.from('orders').delete().eq('id', createdOrder.id);
            } catch (cleanupErr) {
                console.error('[OrdersCreate] cleanup failed', createdOrder.id, cleanupErr);
            }
            console.error('[OrdersCreate] order_items insert failed:', itemsError);
            return NextResponse.json(
                { error: itemsError.message || 'Failed to save order items' },
                { status: 500 }
            );
        }

        // --- Upsert the customer record (best-effort) ----------------------
        try {
            const fullName = `${body.shippingData?.firstName || ''} ${body.shippingData?.lastName || ''}`.trim();
            await supabaseAdmin.rpc('upsert_customer_from_order', {
                p_email: body.email,
                p_phone: body.phone,
                p_full_name: fullName,
                p_first_name: body.shippingData?.firstName || null,
                p_last_name: body.shippingData?.lastName || null,
                p_user_id: body.userId || null,
                p_address: body.shippingData,
            });
        } catch (custErr) {
            console.error('[OrdersCreate] upsert_customer_from_order failed (non-fatal):', custErr);
        }

        return NextResponse.json(
            { id: createdOrder.id, order_number: createdOrder.order_number },
            { status: 201 }
        );
    } catch (err: any) {
        console.error('[OrdersCreate] unexpected error:', err?.message, err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
