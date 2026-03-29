import { NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
    const denied = requireBrainAuth(request);
    if (denied) return denied;

    let shop_name: string | undefined;
    try {
        const { data } = await supabaseAdmin
            .from('site_settings')
            .select('value')
            .eq('key', 'site_name')
            .maybeSingle();
        const v = data?.value;
        if (typeof v === 'string' && v.trim()) shop_name = v.trim();
    } catch {
        // optional
    }

    return NextResponse.json(
        shop_name ? { status: 'ok', shop_name } : { status: 'ok' }
    );
}
