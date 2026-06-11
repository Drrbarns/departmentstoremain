'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchAllPaged } from '@/lib/supabase-paginate';

type ProductRow = {
    id: string;
    name: string;
    slug: string;
    price: number;
    compare_at_price: number | null;
    on_sale: boolean;
    status: string;
    category: string;
    image: string;
    variantsCount: number;
    pausedSalePrice: number | null;
};

const PAGE_SIZE = 24;

const fmt = (v: number) => `GH\u20B5${Number(v || 0).toFixed(2)}`;

/**
 * Regular (pre-sale) price — mirrors the SQL the server uses.
 * When the campaign is paused, the discounted price is stashed in
 * metadata.paused_sale_price and `price` already holds the regular price.
 */
function regularPrice(p: ProductRow): number {
    if (p.pausedSalePrice != null) return p.price;
    if (p.on_sale && p.compare_at_price != null && p.compare_at_price > p.price) {
        return p.compare_at_price;
    }
    return p.price;
}

/** The effective sale price (active discount, or the paused/stashed one). */
function salePrice(p: ProductRow): number | null {
    if (p.pausedSalePrice != null) return p.pausedSalePrice;
    if (p.on_sale && p.compare_at_price != null && p.compare_at_price > p.price) {
        return p.price;
    }
    return null;
}

function discountPct(p: ProductRow): number {
    const reg = regularPrice(p);
    const sale = salePrice(p);
    if (sale == null || reg <= 0 || sale >= reg) return 0;
    return Math.round((1 - sale / reg) * 100);
}

export default function AdminSalesPage() {
    const [products, setProducts] = useState<ProductRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<string[]>([]);

    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [saleFilter, setSaleFilter] = useState<'all' | 'on' | 'off'>('all');
    const [page, setPage] = useState(1);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkPercent, setBulkPercent] = useState('');
    const [bulkFixed, setBulkFixed] = useState('');
    const [rowPrice, setRowPrice] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
    const [salesActive, setSalesActive] = useState(true);
    const [togglingActive, setTogglingActive] = useState(false);

    const fetchSalesActive = useCallback(async () => {
        const { data } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'sales_active')
            .maybeSingle();
        // Missing row defaults to ON. jsonb boolean comes back as a real boolean.
        if (!data) setSalesActive(true);
        else setSalesActive(data.value === true || data.value === 'true');
    }, []);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchAllPaged<any>(() =>
                supabase
                    .from('products')
                    .select(`
                        id, name, slug, price, compare_at_price, on_sale, status, metadata,
                        categories(name),
                        product_variants(count),
                        product_images(url, position)
                    `)
                    .order('created_at', { ascending: false }),
            );
            const rows: ProductRow[] = (data || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                price: Number(p.price) || 0,
                compare_at_price: p.compare_at_price != null ? Number(p.compare_at_price) : null,
                on_sale: !!p.on_sale,
                status: p.status,
                category: p.categories?.name || 'Uncategorized',
                image:
                    p.product_images?.find((i: any) => i.position === 0)?.url ||
                    p.product_images?.[0]?.url ||
                    'https://via.placeholder.com/80?text=No+Image',
                variantsCount: p.product_variants?.[0]?.count || 0,
                pausedSalePrice:
                    p.metadata?.paused_sale_price != null ? Number(p.metadata.paused_sale_price) : null,
            }));
            setProducts(rows);
            setCategories(Array.from(new Set(rows.map((r) => r.category))).sort());
        } catch (err) {
            console.error('[admin/sales] load error:', err);
            setToast({ text: 'Failed to load products', ok: false });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSalesActive();
        fetchProducts();
    }, [fetchSalesActive, fetchProducts]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(t);
    }, [toast]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return products.filter((p) => {
            if (term && !p.name.toLowerCase().includes(term)) return false;
            if (categoryFilter && p.category !== categoryFilter) return false;
            if (saleFilter === 'on' && !p.on_sale) return false;
            if (saleFilter === 'off' && p.on_sale) return false;
            return true;
        });
    }, [products, search, categoryFilter, saleFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => {
        setPage(1);
    }, [search, categoryFilter, saleFilter]);

    const onSaleCount = useMemo(() => products.filter((p) => p.on_sale).length, [products]);

    const allFilteredSelected =
        filtered.length > 0 && filtered.every((p) => selected.has(p.id));

    const toggleSelectAllFiltered = () => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (allFilteredSelected) {
                filtered.forEach((p) => next.delete(p.id));
            } else {
                filtered.forEach((p) => next.add(p.id));
            }
            return next;
        });
    };

    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const callApi = async (payload: Record<string, unknown>) => {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/admin/sales', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token ?? ''}`,
            },
            body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
        return json;
    };

    const toggleSalesActive = async () => {
        const next = !salesActive;
        if (
            !next &&
            !confirm(
                'Turn OFF all sales? Every product will revert to its normal price and the Sale page will be empty until you turn sales back on. Your sale setup is saved and will return when you switch it on.',
            )
        ) {
            return;
        }
        setTogglingActive(true);
        try {
            await callApi({ action: 'set_active', active: next });
            setSalesActive(next);
            await fetchProducts();
            setToast({
                text: next
                    ? 'Sales turned ON — discounts are live again.'
                    : 'Sales turned OFF — all products are at normal prices.',
                ok: true,
            });
        } catch (err: any) {
            setToast({ text: err?.message || 'Failed to toggle sales', ok: false });
        } finally {
            setTogglingActive(false);
        }
    };

    /** Optimistically apply the same math the server uses, so the table updates instantly. */
    const applyLocal = (
        ids: Set<string>,
        kind: 'percentage' | 'fixed' | 'remove',
        value?: number,
    ) => {
        setProducts((prev) =>
            prev.map((p) => {
                if (!ids.has(p.id)) return p;
                if (kind === 'remove') {
                    if (!p.on_sale) return p;
                    return {
                        ...p,
                        price: p.compare_at_price ?? p.price,
                        compare_at_price: null,
                        on_sale: false,
                    };
                }
                const reg = regularPrice(p);
                if (reg <= 0) return p;
                if (kind === 'percentage' && value) {
                    const sale = Math.round(reg * (1 - value / 100) * 100) / 100;
                    return { ...p, price: sale, compare_at_price: reg, on_sale: true };
                }
                if (kind === 'fixed' && value != null) {
                    // Server only applies a fixed price to variant-free products
                    // below the regular price; mirror that here.
                    if (p.variantsCount > 0 || value <= 0 || value >= reg) return p;
                    return { ...p, price: value, compare_at_price: reg, on_sale: true };
                }
                return p;
            }),
        );
    };

    const runBulk = async (kind: 'percentage' | 'fixed' | 'remove') => {
        const ids = Array.from(selected);
        if (ids.length === 0) {
            setToast({ text: 'Select at least one product first', ok: false });
            return;
        }
        let payload: Record<string, unknown>;
        let value: number | undefined;
        if (kind === 'remove') {
            payload = { action: 'remove', productIds: ids };
        } else if (kind === 'percentage') {
            value = Number(bulkPercent);
            if (!Number.isFinite(value) || value <= 0 || value >= 100) {
                setToast({ text: 'Enter a discount between 1 and 99%', ok: false });
                return;
            }
            payload = { action: 'apply', mode: 'percentage', value, productIds: ids };
        } else {
            value = Number(bulkFixed);
            if (!Number.isFinite(value) || value <= 0) {
                setToast({ text: 'Enter a valid sale price', ok: false });
                return;
            }
            payload = { action: 'apply', mode: 'fixed', value, productIds: ids };
        }

        setBusy(true);
        try {
            const json = await callApi(payload);
            applyLocal(new Set(ids), kind, value);
            const n = ids.length;
            if (kind === 'remove') {
                setToast({ text: `Removed ${n} product${n > 1 ? 's' : ''} from sale`, ok: true });
            } else if (kind === 'percentage') {
                setToast({ text: `Applied ${value}% off to ${n} product${n > 1 ? 's' : ''}`, ok: true });
            } else {
                const skipped = json?.skipped ?? 0;
                setToast({
                    text: skipped
                        ? `Set sale price on ${n - skipped} product${n - skipped !== 1 ? 's' : ''}. ${skipped} skipped (variant products / price not below regular).`
                        : `Set sale price on ${n} product${n > 1 ? 's' : ''}`,
                    ok: true,
                });
            }
            setSelected(new Set());
            setBulkPercent('');
            setBulkFixed('');
        } catch (err: any) {
            setToast({ text: err?.message || 'Action failed', ok: false });
        } finally {
            setBusy(false);
        }
    };

    const applyRowPrice = async (p: ProductRow) => {
        const value = Number(rowPrice[p.id]);
        if (!Number.isFinite(value) || value <= 0) {
            setToast({ text: 'Enter a valid sale price', ok: false });
            return;
        }
        if (value >= regularPrice(p)) {
            setToast({ text: 'Sale price must be below the regular price', ok: false });
            return;
        }
        setBusy(true);
        try {
            await callApi({ action: 'apply', mode: 'fixed', value, productIds: [p.id] });
            applyLocal(new Set([p.id]), 'fixed', value);
            setRowPrice((prev) => ({ ...prev, [p.id]: '' }));
            setToast({ text: `${p.name} set to ${fmt(value)}`, ok: true });
        } catch (err: any) {
            setToast({ text: err?.message || 'Action failed', ok: false });
        } finally {
            setBusy(false);
        }
    };

    const removeRow = async (p: ProductRow) => {
        setBusy(true);
        try {
            await callApi({ action: 'remove', productIds: [p.id] });
            applyLocal(new Set([p.id]), 'remove');
            setToast({ text: `${p.name} removed from sale`, ok: true });
        } catch (err: any) {
            setToast({ text: err?.message || 'Action failed', ok: false });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
                    <p className="text-gray-600 mt-1">
                        Put products on sale in bulk. Pick items, set a discount % or a fixed price, and apply.
                    </p>
                </div>
                <Link
                    href="/sale"
                    target="_blank"
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2 text-sm font-medium"
                >
                    <i className="ri-external-link-line"></i>
                    View Sale page
                </Link>
            </div>

            {/* Master on/off switch */}
            <div
                className={`rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    salesActive ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                }`}
            >
                <div className="flex items-start gap-3">
                    <i
                        className={`text-2xl mt-0.5 ${
                            salesActive ? 'ri-flashlight-fill text-green-600' : 'ri-pause-circle-line text-amber-600'
                        }`}
                    ></i>
                    <div>
                        <p className="font-semibold text-gray-900">
                            Sales are currently {salesActive ? 'ON' : 'OFF'}
                        </p>
                        <p className="text-sm text-gray-600 mt-0.5 max-w-xl">
                            {salesActive
                                ? 'Discounts are live on the storefront and the Sale page shows your sale items.'
                                : 'All products show their normal prices and the Sale page is empty. Your sale setup is saved — turn it back on anytime.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={toggleSalesActive}
                    disabled={togglingActive || busy}
                    role="switch"
                    aria-checked={salesActive}
                    className={`relative inline-flex h-9 w-16 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                        salesActive ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                    aria-label="Toggle all sales"
                >
                    <span
                        className={`inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform ${
                            salesActive ? 'translate-x-8' : 'translate-x-1'
                        }`}
                    >
                        {togglingActive && (
                            <i className="ri-loader-4-line animate-spin text-gray-500 text-sm absolute inset-0 flex items-center justify-center"></i>
                        )}
                    </span>
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Total products</p>
                    <p className="text-2xl font-bold text-gray-900">{products.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">On sale</p>
                    <p className="text-2xl font-bold text-red-600">{onSaleCount}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Not on sale</p>
                    <p className="text-2xl font-bold text-gray-900">{products.length - onSaleCount}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col md:flex-row gap-3 md:items-center">
                <div className="relative flex-1">
                    <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search products by name…"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                <select
                    value={saleFilter}
                    onChange={(e) => setSaleFilter(e.target.value as 'all' | 'on' | 'off')}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All products</option>
                    <option value="on">On sale</option>
                    <option value="off">Not on sale</option>
                </select>
            </div>

            {/* Bulk action bar — only while sales are ON (editing while paused
                would create an inconsistent discounted-but-hidden state). */}
            {!salesActive ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 flex items-center gap-2">
                    <i className="ri-information-line text-gray-400 text-lg"></i>
                    Editing is disabled while sales are off. Turn sales on above to add or change product sales.
                </div>
            ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sticky top-2 z-20">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="flex items-center gap-2 lg:w-56">
                        <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleSelectAllFiltered}
                            className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-700">
                            {selected.size > 0
                                ? `${selected.size} selected`
                                : `Select all ${filtered.length} filtered`}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                min={1}
                                max={99}
                                value={bulkPercent}
                                onChange={(e) => setBulkPercent(e.target.value)}
                                placeholder="%"
                                className="w-20 px-3 py-2 border border-gray-300 rounded-lg"
                            />
                            <button
                                onClick={() => runBulk('percentage')}
                                disabled={busy || selected.size === 0}
                                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                            >
                                Apply % off
                            </button>
                        </div>

                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={bulkFixed}
                                onChange={(e) => setBulkFixed(e.target.value)}
                                placeholder="₵ price"
                                className="w-28 px-3 py-2 border border-gray-300 rounded-lg"
                            />
                            <button
                                onClick={() => runBulk('fixed')}
                                disabled={busy || selected.size === 0}
                                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                            >
                                Set price
                            </button>
                        </div>

                        <button
                            onClick={() => runBulk('remove')}
                            disabled={busy || selected.size === 0}
                            className="px-4 py-2 bg-white border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-sm font-semibold disabled:opacity-50"
                        >
                            Remove from sale
                        </button>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Fixed price applies only to products without variants and must be below the regular price.
                    For variant products use a percentage.
                </p>
            </div>
            )}

            {toast && (
                <div
                    className={`rounded-lg px-4 py-3 text-sm ${
                        toast.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                >
                    {toast.text}
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-500">
                        <i className="ri-loader-4-line text-3xl animate-spin block mb-2"></i>
                        Loading products…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">No products match your filters.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-left border-b border-gray-200">
                                    <th className="p-3 w-10"></th>
                                    <th className="p-3 font-semibold">Product</th>
                                    <th className="p-3 font-semibold">Regular</th>
                                    <th className="p-3 font-semibold">Sale price</th>
                                    <th className="p-3 font-semibold">Off</th>
                                    <th className="p-3 font-semibold">Set price</th>
                                    <th className="p-3 font-semibold"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.map((p) => {
                                    const reg = regularPrice(p);
                                    const sale = salePrice(p);
                                    const pct = discountPct(p);
                                    return (
                                        <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/70">
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(p.id)}
                                                    onChange={() => toggleOne(p.id)}
                                                    disabled={!salesActive}
                                                    className="w-4 h-4 rounded border-gray-300 disabled:opacity-40"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-3">
                                                    <img src={p.image} alt="" className="w-10 h-10 rounded object-cover bg-gray-100 flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-gray-900 truncate max-w-[260px]">{p.name}</div>
                                                        <div className="text-xs text-gray-500 flex items-center gap-2">
                                                            <span>{p.category}</span>
                                                            {p.variantsCount > 0 && (
                                                                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                                                                    {p.variantsCount} variants
                                                                </span>
                                                            )}
                                                            {p.status !== 'active' && (
                                                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">{p.status}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 whitespace-nowrap text-gray-700">{fmt(reg)}</td>
                                            <td className="p-3 whitespace-nowrap">
                                                {sale != null ? (
                                                    <span className="font-semibold text-red-600">
                                                        {fmt(sale)}
                                                        {!salesActive && (
                                                            <span className="ml-1 text-[10px] font-normal text-amber-600">(paused)</span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                {pct > 0 ? (
                                                    <span className="inline-block px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs font-bold">-{pct}%</span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                {!salesActive ? (
                                                    <span className="text-xs text-gray-300">—</span>
                                                ) : p.variantsCount > 0 ? (
                                                    <span className="text-xs text-gray-400">use % off</span>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step="0.01"
                                                            value={rowPrice[p.id] ?? ''}
                                                            onChange={(e) => setRowPrice((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                                            placeholder="₵"
                                                            className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg"
                                                        />
                                                        <button
                                                            onClick={() => applyRowPrice(p)}
                                                            disabled={busy}
                                                            className="px-2.5 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-medium disabled:opacity-50"
                                                        >
                                                            Set
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                {salesActive && p.on_sale && (
                                                    <button
                                                        onClick={() => removeRow(p)}
                                                        disabled={busy}
                                                        className="text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-50 whitespace-nowrap"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {!loading && filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                        Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 text-sm"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600">Page {currentPage} / {totalPages}</span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 text-sm"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
