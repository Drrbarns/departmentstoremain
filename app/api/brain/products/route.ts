import { NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-auth';
import { fetchActiveProducts, toBrainProduct } from '@/lib/brain-products';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
    const denied = requireBrainAuth(request);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const rows = await fetchActiveProducts(supabaseAdmin, {
        category: category || undefined,
        search: search || undefined,
    });

    return NextResponse.json({
        products: rows.map(toBrainProduct),
    });
}
