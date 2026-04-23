import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

const LOOKUP_RATE_LIMIT = { maxRequests: 30, windowSeconds: 60 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_NUMBER_RE = /^ORD-\d+-\d+$/;

/**
 * Minimal payment summary for the /pay/[orderId] page.
 *
 * Security model:
 *   - Only accepts a UUID or ORD-{ts}-{rand} order number (unguessable bearer refs).
 *   - Returns ONLY the fields needed to render the summary and kick off Moolre.
 *   - Never returns the full shipping address or PII beyond the first name.
 *   - Rate-limited per IP.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
    try {
        const { orderId } = await ctx.params;
        const raw = (orderId || '').trim();

        if (!raw || (!UUID_RE.test(raw) && !ORDER_NUMBER_RE.test(raw))) {
            return NextResponse.json({ error: 'Invalid order reference' }, { status: 400 });
        }

        const clientId = getClientIdentifier(_req);
        const rl = checkRateLimit(`pay-summary:${clientId}`, LOOKUP_RATE_LIMIT);
        if (!rl.success) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const isUUID = UUID_RE.test(raw);
        const column = isUUID ? 'id' : 'order_number';

        const { data: order, error } = await supabaseAdmin
            .from('orders')
            .select('id, order_number, payment_status, subtotal, shipping_total, discount_total, total, metadata, shipping_address')
            .eq(column, raw)
            .maybeSingle();

        if (error || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const meta = (order.metadata ?? {}) as Record<string, any>;
        const shipping = (order.shipping_address ?? {}) as Record<string, any>;

        return NextResponse.json({
            order: {
                id: order.id,
                order_number: order.order_number,
                payment_status: order.payment_status,
                subtotal: order.subtotal,
                shipping_total: order.shipping_total,
                discount_total: order.discount_total,
                total: order.total,
                metadata: {
                    first_name: meta.first_name ?? shipping.firstName ?? null,
                    moolre_externalref: meta.moolre_externalref ?? null,
                    auto_removed_items: meta.auto_removed_items ?? null,
                },
                shipping_address: {
                    firstName: shipping.firstName ?? null,
                },
            },
        });
    } catch (err: any) {
        console.error('[PaymentSummary] Error:', err?.message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
