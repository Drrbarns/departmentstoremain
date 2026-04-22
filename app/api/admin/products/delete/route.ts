import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Delete one or more products transactionally, then clean up their images
 * from Supabase Storage.
 *
 * The DB work happens inside delete_products_with_relations() so all seven
 * delete/update statements either fully succeed or fully roll back.
 */
export async function POST(request: Request) {
    const auth = await verifyAuth(request, { requireAdmin: true, requireFullStaff: true });
    if (!auth.authenticated) {
        return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const ids: unknown = body?.ids;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
        }
        if (ids.length > 200) {
            return NextResponse.json({ error: 'Too many ids (max 200 per call)' }, { status: 400 });
        }
        if (!ids.every((id) => typeof id === 'string' && UUID_RE.test(id))) {
            return NextResponse.json({ error: 'All ids must be UUIDs' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin.rpc('delete_products_with_relations', {
            p_ids: ids,
        });

        if (error) {
            console.error('[admin/products/delete] RPC error:', error.message);
            return NextResponse.json({ error: 'Failed to delete products' }, { status: 500 });
        }

        const urls: string[] = Array.isArray(data) && data[0]?.image_urls ? data[0].image_urls : [];

        // Strip the storage path from each URL — Supabase public URLs look like
        //   https://<proj>.supabase.co/storage/v1/object/public/products/<path>
        const storagePaths = urls
            .map((u) => {
                try {
                    const parsed = new URL(u);
                    const marker = '/storage/v1/object/public/products/';
                    const idx = parsed.pathname.indexOf(marker);
                    if (idx === -1) return null;
                    return parsed.pathname.slice(idx + marker.length);
                } catch {
                    return null;
                }
            })
            .filter((p): p is string => !!p);

        if (storagePaths.length > 0) {
            try {
                const { error: storageErr } = await supabaseAdmin.storage
                    .from('products')
                    .remove(storagePaths);
                if (storageErr) {
                    // Non-fatal — DB rows are already gone; log for manual cleanup.
                    console.warn('[admin/products/delete] storage cleanup error:', storageErr.message);
                }
            } catch (err: any) {
                console.warn('[admin/products/delete] storage cleanup threw:', err?.message);
            }
        }

        return NextResponse.json({ success: true, removed: ids.length, storagePaths: storagePaths.length });
    } catch (err: any) {
        console.error('[admin/products/delete] error:', err?.message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
