import { NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
    const denied = requireBrainAuth(request);
    if (denied) return denied;

    const { data, error } = await supabaseAdmin
        .from('categories')
        .select('name')
        .eq('status', 'active')
        .order('position', { ascending: true })
        .order('name', { ascending: true });

    if (error) {
        return NextResponse.json(
            { error: 'Failed to load categories' },
            { status: 500 }
        );
    }

    const names = (data ?? [])
        .map((r) => r.name)
        .filter((n): n is string => typeof n === 'string' && n.length > 0);

    return NextResponse.json({ categories: names });
}
