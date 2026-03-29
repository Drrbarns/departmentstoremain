import type { SupabaseClient } from '@supabase/supabase-js';

export type BrainProductRow = {
    id: string;
    name: string;
    description: string | null;
    short_description: string | null;
    price: number | string;
    quantity: number | null;
    track_quantity: boolean | null;
    continue_selling: boolean | null;
    moq: number | null;
    /** Supabase may infer this as a single object or a one-element array. */
    categories: { name: string; slug: string } | { name: string; slug: string }[] | null;
    product_images: { url: string; position: number | null }[] | null;
};

export function productInStock(p: {
    quantity: number | null;
    track_quantity: boolean | null;
    continue_selling: boolean | null;
}): boolean {
    if (p.continue_selling) return true;
    if (p.track_quantity === false) return true;
    return (p.quantity ?? 0) > 0;
}

function firstImageUrl(images: BrainProductRow['product_images']): string | null {
    if (!images?.length) return null;
    const sorted = [...images].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );
    return sorted[0]?.url ?? null;
}

function categoryFromRow(
    c: BrainProductRow['categories']
): { name: string; slug: string } | null {
    if (!c) return null;
    return Array.isArray(c) ? c[0] ?? null : c;
}

export function toBrainProduct(p: BrainProductRow) {
    const cat = categoryFromRow(p.categories);
    const category = cat?.name ?? cat?.slug ?? null;
    return {
        id: p.id,
        name: p.name,
        description: p.description ?? p.short_description ?? null,
        price: Number(p.price),
        category,
        in_stock: productInStock(p),
        image_url: firstImageUrl(p.product_images),
    };
}

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
    return UUID_RE.test(s);
}

/** Strip LIKE wildcards from user-controlled search input. */
export function sanitizeSearchFragment(s: string): string {
    return s.replace(/[%_]/g, '').trim();
}

export async function resolveCategoryId(
    supabase: SupabaseClient,
    param: string
): Promise<string | null> {
    const trimmed = param.trim();
    if (!trimmed) return null;

    const { data: bySlug } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', trimmed)
        .eq('status', 'active')
        .maybeSingle();

    if (bySlug?.id) return bySlug.id;

    const frag = sanitizeSearchFragment(trimmed);
    if (!frag) return null;

    const { data: byName } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', `%${frag}%`)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

    return byName?.id ?? null;
}

const productSelect = `
  id,
  name,
  description,
  short_description,
  price,
  quantity,
  track_quantity,
  continue_selling,
  moq,
  categories ( name, slug ),
  product_images ( url, position )
`;

export async function fetchActiveProductById(
    supabase: SupabaseClient,
    id: string
): Promise<BrainProductRow | null> {
    const { data, error } = await supabase
        .from('products')
        .select(productSelect)
        .eq('id', id)
        .eq('status', 'active')
        .maybeSingle();

    if (error || !data) return null;
    return data as unknown as BrainProductRow;
}

export async function fetchActiveProducts(
    supabase: SupabaseClient,
    options: { category?: string | null; search?: string | null }
): Promise<BrainProductRow[]> {
    let query = supabase
        .from('products')
        .select(productSelect)
        .eq('status', 'active')
        .order('name', { ascending: true });

    if (options.category) {
        const catId = await resolveCategoryId(supabase, options.category);
        if (catId) {
            query = query.eq('category_id', catId);
        } else {
            return [];
        }
    }

    const frag = options.search ? sanitizeSearchFragment(options.search) : '';
    if (frag) {
        query = query.ilike('name', `%${frag}%`);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as unknown as BrainProductRow[];
}
