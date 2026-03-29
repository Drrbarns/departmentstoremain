import { NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-auth';
import {
    fetchActiveProductById,
    isUuid,
    productInStock,
} from '@/lib/brain-products';
import { supabaseAdmin } from '@/lib/supabase-admin';

type NormalizedItem = { product_id: string; quantity: number };

function normalizeItems(raw: unknown): NormalizedItem[] | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const map = new Map<string, number>();
    for (const row of raw) {
        if (!row || typeof row !== 'object') return null;
        const product_id = (row as { product_id?: unknown }).product_id;
        const quantity = (row as { quantity?: unknown }).quantity;
        if (typeof product_id !== 'string' || !isUuid(product_id)) return null;
        if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
            return null;
        }
        map.set(product_id, (map.get(product_id) ?? 0) + quantity);
    }
    return Array.from(map.entries()).map(([product_id, quantity]) => ({
        product_id,
        quantity,
    }));
}

function splitName(full: string | undefined): { firstName: string; lastName: string } {
    const t = (full ?? '').trim();
    if (!t) return { firstName: 'WhatsApp', lastName: 'Customer' };
    const i = t.indexOf(' ');
    if (i === -1) return { firstName: t, lastName: '' };
    return { firstName: t.slice(0, i), lastName: t.slice(i + 1).trim() };
}

export async function POST(request: Request) {
    const denied = requireBrainAuth(request);
    if (denied) return denied;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const items = normalizeItems((body as { items?: unknown }).items);
    if (!items) {
        return NextResponse.json(
            { error: 'items must be a non-empty array of { product_id, quantity }' },
            { status: 400 }
        );
    }

    const customer_phone = String(
        (body as { customer_phone?: unknown }).customer_phone ?? ''
    ).trim();
    if (!customer_phone) {
        return NextResponse.json({ error: 'customer_phone is required' }, { status: 400 });
    }

    const customer_name =
        typeof (body as { customer_name?: unknown }).customer_name === 'string'
            ? (body as { customer_name: string }).customer_name
            : undefined;

    const { firstName, lastName } = splitName(customer_name);

    const lines: {
        product_id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
        line_total: number;
        moq: number;
        stockOk: boolean;
    }[] = [];

    for (const { product_id, quantity } of items) {
        const row = await fetchActiveProductById(supabaseAdmin, product_id);
        if (!row) {
            return NextResponse.json(
                { error: `Product not found or inactive: ${product_id}` },
                { status: 400 }
            );
        }

        const moq = row.moq && row.moq >= 1 ? row.moq : 1;
        if (quantity < moq) {
            return NextResponse.json(
                {
                    error: `Quantity below minimum for ${row.name} (moq ${moq})`,
                },
                { status: 400 }
            );
        }

        const track = row.track_quantity !== false;
        const available = row.quantity ?? 0;
        const stockOk =
            row.continue_selling === true ||
            !track ||
            available >= quantity;

        if (!stockOk) {
            return NextResponse.json(
                { error: `Insufficient stock for ${row.name}` },
                { status: 400 }
            );
        }

        const unit_price = Number(row.price);
        lines.push({
            product_id,
            product_name: row.name,
            quantity,
            unit_price,
            line_total: unit_price * quantity,
            moq,
            stockOk: productInStock(row),
        });
    }

    const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
    const tax_total = 0;
    const shipping_total = 0;
    const total = subtotal + tax_total + shipping_total;

    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const trackingId = Array.from({ length: 6 }, () =>
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 32))
    ).join('');
    const trackingNumber = `SLI-${trackingId}`;

    const emailLocal = `wa-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const email = `${emailLocal}@orders.brain.local`;

    const shipping_address = {
        firstName,
        lastName,
        email,
        phone: customer_phone,
        address: 'WhatsApp order',
        city: '',
        region: '',
    };

    const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert([
            {
                order_number: orderNumber,
                user_id: null,
                email,
                phone: customer_phone,
                status: 'pending',
                payment_status: 'pending',
                currency: 'GHS',
                subtotal,
                tax_total,
                shipping_total,
                discount_total: 0,
                total,
                shipping_method: 'whatsapp',
                payment_method: 'whatsapp',
                shipping_address,
                billing_address: shipping_address,
                notes: null,
                metadata: {
                    source: 'whatsapp',
                    brain: true,
                    customer_name: customer_name ?? null,
                    tracking_number: trackingNumber,
                },
            },
        ])
        .select('id, order_number, status, total')
        .single();

    if (orderError || !order) {
        console.error('[brain/orders] insert order', orderError);
        return NextResponse.json(
            { error: 'Failed to create order' },
            { status: 500 }
        );
    }

    const orderItemsPayload = lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        variant_id: null,
        product_name: l.product_name,
        variant_name: null,
        sku: null,
        quantity: l.quantity,
        unit_price: l.unit_price,
        total_price: l.line_total,
        metadata: { source: 'whatsapp' },
    }));

    const { error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(orderItemsPayload);

    if (itemsError) {
        console.error('[brain/orders] insert items', itemsError);
        await supabaseAdmin.from('orders').delete().eq('id', order.id);
        return NextResponse.json(
            { error: 'Failed to create order items' },
            { status: 500 }
        );
    }

    return NextResponse.json({
        order_id: order.id,
        total: Number(order.total),
        status: order.status,
        items: lines.map((l) => ({
            product_id: l.product_id,
            product_name: l.product_name,
            quantity: l.quantity,
            unit_price: l.unit_price,
            line_total: l.line_total,
        })),
    });
}
