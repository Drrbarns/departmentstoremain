import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export interface StockIssue {
    name: string;
    variant?: string;
}

export interface ValidateStockResponse {
    valid: boolean;
    outOfStock: StockIssue[];
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const { orderId } = await params;

    if (!orderId) {
        return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    // Resolve order (accepts UUID or order_number)
    const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('id, payment_status')
        .or(`id.eq.${orderId},order_number.eq.${orderId}`)
        .single();

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Already paid — nothing to validate
    if (order.payment_status === 'paid') {
        return NextResponse.json({ valid: true, outOfStock: [] } satisfies ValidateStockResponse);
    }

    const { data: items, error: itemsError } = await supabaseAdmin
        .from('order_items')
        .select('product_id, variant_id, product_name, variant_name, quantity')
        .eq('order_id', order.id);

    if (itemsError || !items) {
        return NextResponse.json({ error: 'Could not load order items' }, { status: 500 });
    }

    const variantIds = items.filter(i => i.variant_id).map(i => i.variant_id as string);
    const productIdsNoVariant = items
        .filter(i => !i.variant_id && i.product_id)
        .map(i => i.product_id as string);

    // Batch-fetch variant stock
    const variantStockMap: Record<string, number> = {};
    if (variantIds.length > 0) {
        const { data: variants } = await supabaseAdmin
            .from('product_variants')
            .select('id, quantity')
            .in('id', variantIds);
        for (const v of variants ?? []) {
            variantStockMap[v.id] = v.quantity ?? 0;
        }
    }

    // Batch-fetch product stock (only for items without a variant)
    const productStockMap: Record<string, {
        quantity: number | null;
        track_quantity: boolean | null;
        continue_selling: boolean | null;
    }> = {};
    if (productIdsNoVariant.length > 0) {
        const { data: products } = await supabaseAdmin
            .from('products')
            .select('id, quantity, track_quantity, continue_selling')
            .in('id', productIdsNoVariant);
        for (const p of products ?? []) {
            productStockMap[p.id] = p;
        }
    }

    const outOfStock: StockIssue[] = [];

    for (const item of items) {
        const needed = Number(item.quantity ?? 0);
        if (item.variant_id) {
            const qty = variantStockMap[item.variant_id] ?? -1;
            if (qty < needed) {
                outOfStock.push({
                    name: item.product_name,
                    variant: item.variant_name ?? undefined,
                });
            }
        } else if (item.product_id) {
            const p = productStockMap[item.product_id];
            const inStock = p
                && (p.continue_selling || p.track_quantity === false || (p.quantity ?? 0) >= needed);
            if (!inStock) {
                outOfStock.push({ name: item.product_name });
            }
        }
    }

    return NextResponse.json({
        valid: outOfStock.length === 0,
        outOfStock,
    } satisfies ValidateStockResponse);
}
