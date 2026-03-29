import { NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-auth';
import { isUuid } from '@/lib/brain-products';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const denied = requireBrainAuth(request);
    if (denied) return denied;

    const { id: rawId } = await params;
    const id = rawId?.trim();
    if (!id) {
        return NextResponse.json({ error: 'Missing order id' }, { status: 400 });
    }

    let query = supabaseAdmin
        .from('orders')
        .select(
            `
      id,
      order_number,
      status,
      payment_status,
      total,
      currency,
      created_at,
      metadata,
      order_items (
        product_id,
        product_name,
        quantity,
        unit_price,
        total_price
      )
    `
        );

    if (isUuid(id)) {
        query = query.eq('id', id);
    } else {
        query = query.eq('order_number', id);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const items = (order.order_items as Array<{
        product_id: string | null;
        product_name: string;
        quantity: number;
        unit_price: number | string;
        total_price: number | string;
    }> | null) ?? [];

    return NextResponse.json({
        order_id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        total: Number(order.total),
        currency: order.currency,
        created_at: order.created_at,
        source:
            typeof order.metadata === 'object' &&
            order.metadata &&
            'source' in order.metadata
                ? (order.metadata as { source?: string }).source
                : undefined,
        items: items.map((r) => ({
            product_id: r.product_id,
            product_name: r.product_name,
            quantity: r.quantity,
            unit_price: Number(r.unit_price),
            line_total: Number(r.total_price),
        })),
    });
}
