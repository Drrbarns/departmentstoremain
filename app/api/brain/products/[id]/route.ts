import { NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-auth';
import { fetchActiveProductById, isUuid, toBrainProduct } from '@/lib/brain-products';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const denied = requireBrainAuth(request);
    if (denied) return denied;

    const { id } = await params;
    if (!id || !isUuid(id)) {
        return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
    }

    const row = await fetchActiveProductById(supabaseAdmin, id);
    if (!row) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product: toBrainProduct(row) });
}
