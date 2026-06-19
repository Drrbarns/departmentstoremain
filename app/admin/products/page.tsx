'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllPaged } from '@/lib/supabase-paginate';

const PRODUCTS_SCROLL_KEY = 'admin_products_scroll_y';
const PRODUCTS_UI_STATE_KEY = 'admin_products_ui_state';

export default function ProductsPage() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [variantFilter, setVariantFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [bulkStatus, setBulkStatus] = useState('draft');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const pendingScrollRestoreRef = useRef<number | null>(null);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    lowStock: 0,
    outOfStock: 0,
    active: 0
  });

  const statusColors: any = {
    'active': 'bg-blue-100 text-blue-700',
    'draft': 'bg-gray-100 text-gray-700',
    'archived': 'bg-amber-100 text-amber-700',
  };

  useEffect(() => {
    // Restore scroll when returning from the edit page.
    if (typeof window === 'undefined') return;
    const savedScroll = sessionStorage.getItem(PRODUCTS_SCROLL_KEY);
    if (!savedScroll) return;
    const parsed = Number(savedScroll);
    if (!Number.isNaN(parsed) && parsed > 0) {
      pendingScrollRestoreRef.current = parsed;
    }

    const savedState = sessionStorage.getItem(PRODUCTS_UI_STATE_KEY);
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        if (typeof parsedState.viewMode === 'string') setViewMode(parsedState.viewMode);
        if (typeof parsedState.sortBy === 'string') setSortBy(parsedState.sortBy);
        if (typeof parsedState.searchQuery === 'string') setSearchQuery(parsedState.searchQuery);
        if (typeof parsedState.categoryFilter === 'string') setCategoryFilter(parsedState.categoryFilter);
        if (typeof parsedState.statusFilter === 'string') setStatusFilter(parsedState.statusFilter);
        if (typeof parsedState.variantFilter === 'string') setVariantFilter(parsedState.variantFilter);
        if (typeof parsedState.showFilters === 'boolean') setShowFilters(parsedState.showFilters);
      } catch {
        // Ignore invalid saved UI state
      }
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (pendingScrollRestoreRef.current === null) return;

    const y = pendingScrollRestoreRef.current;
    pendingScrollRestoreRef.current = null;
    sessionStorage.removeItem(PRODUCTS_SCROLL_KEY);
    sessionStorage.removeItem(PRODUCTS_UI_STATE_KEY);

    // Wait one paint so table rows exist before restoring.
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: 'auto' });
    });
  }, [loading, products.length]);

  const saveScrollForReturn = () => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(PRODUCTS_SCROLL_KEY, String(window.scrollY));
    sessionStorage.setItem(PRODUCTS_UI_STATE_KEY, JSON.stringify({
      viewMode,
      sortBy,
      searchQuery,
      categoryFilter,
      statusFilter,
      variantFilter,
      showFilters
    }));
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [sortBy]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('name');
    if (data) setCategories(data);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);

      // Page through every product.  PostgREST silently caps a bare select
      // at 1000 rows and `.range(0, 2499)` does NOT bypass that — we have
      // to issue multiple requests.  We pass a factory that rebuilds the
      // sorted query for each chunk.
      const buildQuery = () => {
        let query = supabase
          .from('products')
          .select(`
            *,
            categories(name),
            product_variants(count),
            product_images(url, position)
          `);
        if (sortBy === 'newest') query = query.order('created_at', { ascending: false });
        if (sortBy === 'price_asc') query = query.order('price', { ascending: true });
        if (sortBy === 'price_desc') query = query.order('price', { ascending: false });
        if (sortBy === 'name') query = query.order('name', { ascending: true });
        if (sortBy === 'stock') query = query.order('quantity', { ascending: true });
        return query;
      };

      const data = await fetchAllPaged<any>(buildQuery);

      {
        // Transform data for UI
        const transformedProducts = data.map((p: any) => ({
          ...p,
          category: p.categories?.name || 'Uncategorized',
          image: p.product_images?.find((img: any) => img.position === 0)?.url
            || p.product_images?.[0]?.url
            || 'https://via.placeholder.com/300?text=No+Image',
          variantsCount: p.product_variants?.[0]?.count || 0,
          stock: p.quantity,
          sales: 0, // Placeholder for now
          rating: p.rating_avg || 0
        }));

        setProducts(transformedProducts);

        // Calculate stats locally for now (better to do count queries in production)
        setStats({
          total: transformedProducts.length,
          lowStock: transformedProducts.filter(p => p.quantity < (p.metadata?.low_stock_threshold || 5) && p.quantity > 0).length,
          outOfStock: transformedProducts.filter(p => p.quantity === 0).length,
          active: transformedProducts.filter(p => p.status === 'active').length
        });
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintStockList = async () => {
    if (printing) return;
    setPrinting(true);

    // Open the print window synchronously (before any await) so popup
    // blockers don't kill it. Show a placeholder until the report is ready.
    const win = window.open('', '_blank');
    if (win) {
      win.document.write('<!doctype html><title>Stock list</title><body style="font-family:sans-serif;padding:40px;color:#374151">Generating stock list…</body>');
    }

    try {
      const esc = (v: any) =>
        String(v ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

      // The list on screen is already filtered/sorted; print exactly that set.
      const rows = filteredProducts;
      const ids = rows.map((p) => p.id);

      // Pull every variant for the products being printed. Fetch all variants
      // in pages and group locally — far cheaper than a giant `.in(...)` URL.
      const variantMap = new Map<string, any[]>();
      if (ids.length > 0) {
        const idSet = new Set(ids);
        const allVariants = await fetchAllPaged<any>(() =>
          supabase
            .from('product_variants')
            .select('product_id, name, sku, option1, option2, option3, quantity')
            .order('option2', { ascending: true })
            .order('option1', { ascending: true }),
        );
        for (const v of allVariants) {
          if (!idSet.has(v.product_id)) continue;
          const list = variantMap.get(v.product_id) || [];
          list.push(v);
          variantMap.set(v.product_id, list);
        }
      }

      const variantLabel = (v: any) =>
        [v.option2, v.option1, v.option3].filter(Boolean).join(' / ') ||
        (v.name && v.name !== 'Default' ? v.name : '') ||
        'Default';

      let totalUnits = 0;
      let lowCount = 0;
      let outCount = 0;
      let variantLineCount = 0;

      const bodyRows = rows
        .map((p) => {
          const variants = variantMap.get(p.id) || [];
          const threshold = p.metadata?.low_stock_threshold || 5;
          const category = esc(p.category || 'Uncategorized');

          if (variants.length > 0) {
            const productTotal = variants.reduce((s, v) => s + (v.quantity || 0), 0);
            totalUnits += productTotal;
            variantLineCount += variants.length;

            const head = `
              <tr class="prow group-head">
                <td class="pname">${esc(p.name)}</td>
                <td class="sku">${esc(p.sku || '—')}</td>
                <td>${category}</td>
                <td class="variant muted">${variants.length} variant${variants.length !== 1 ? 's' : ''}</td>
                <td class="num total">${productTotal}</td>
              </tr>`;
            const sub = variants
              .map((v) => {
                const q = v.quantity || 0;
                if (q === 0) outCount += 1;
                else if (q <= threshold) lowCount += 1;
                const flag = q === 0 ? ' out' : q <= threshold ? ' low' : '';
                return `
                  <tr class="vrow${flag}">
                    <td class="indent" colspan="2"></td>
                    <td class="sku">${esc(v.sku || '—')}</td>
                    <td class="variant">${esc(variantLabel(v))}</td>
                    <td class="num">${q}${q === 0 ? ' <span class="tag out">OUT</span>' : q <= threshold ? ' <span class="tag low">LOW</span>' : ''}</td>
                  </tr>`;
              })
              .join('');
            return head + sub;
          }

          const q = p.stock ?? p.quantity ?? 0;
          totalUnits += q;
          if (q === 0) outCount += 1;
          else if (q <= threshold) lowCount += 1;
          const flag = q === 0 ? ' out' : q <= threshold ? ' low' : '';
          return `
            <tr class="prow${flag}">
              <td class="pname">${esc(p.name)}</td>
              <td class="sku">${esc(p.sku || '—')}</td>
              <td>${category}</td>
              <td class="variant muted">—</td>
              <td class="num total">${q}${q === 0 ? ' <span class="tag out">OUT</span>' : q <= threshold ? ' <span class="tag low">LOW</span>' : ''}</td>
            </tr>`;
        })
        .join('');

      const appliedFilters = [
        categoryFilter && `Category: ${categoryFilter}`,
        statusFilter && `Status: ${statusFilter}`,
        variantFilter === 'with' ? 'With variants' : variantFilter === 'without' ? 'Without variants' : '',
        stockFilter === 'low' ? 'Low stock only' : stockFilter === 'out' ? 'Out of stock only' : '',
        searchQuery && `Search: "${searchQuery}"`,
      ].filter(Boolean) as string[];

      const generatedAt = new Date().toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Product & Stock List — Discount Discovery Zone</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; margin: 0; padding: 28px 32px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
  .meta strong { color: #374151; }
  .summary { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 14px; min-width: 110px; }
  .card .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .03em; }
  .card .value { font-size: 18px; font-weight: 700; }
  .card.low .value { color: #b45309; }
  .card.out .value { color: #b91c1c; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead { display: table-header-group; }
  th { text-align: left; background: #f3f4f6; border-bottom: 2px solid #d1d5db; padding: 7px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #374151; }
  td { padding: 6px 8px; border-bottom: 1px solid #eef0f2; vertical-align: top; }
  th.num, td.num { text-align: right; white-space: nowrap; }
  .prow.group-head td { border-bottom: none; padding-top: 9px; }
  .prow td { font-weight: 600; }
  .vrow td { color: #4b5563; font-weight: 400; }
  .vrow .variant { font-weight: 500; color: #111827; }
  .pname { max-width: 320px; }
  .sku { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #6b7280; }
  .muted { color: #9ca3af; }
  .total { font-weight: 700; }
  .tag { font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 4px; vertical-align: middle; }
  .tag.low { background: #fef3c7; color: #b45309; }
  .tag.out { background: #fee2e2; color: #b91c1c; }
  tr { break-inside: avoid; }
  .footer { margin-top: 18px; color: #9ca3af; font-size: 11px; }
  @media print {
    body { padding: 0; }
    .noprint { display: none; }
    @page { margin: 14mm 12mm; }
  }
  .toolbar { position: sticky; top: 0; background: #fff; padding-bottom: 12px; margin-bottom: 8px; }
  .btn { background: #1d4ed8; color: #fff; border: none; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
  <div class="toolbar noprint">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <h1>Product &amp; Stock List</h1>
  <div class="meta">
    Discount Discovery Zone &nbsp;•&nbsp; Generated <strong>${esc(generatedAt)}</strong>
    ${appliedFilters.length ? `&nbsp;•&nbsp; Filters: ${esc(appliedFilters.join(' · '))}` : ''}
  </div>
  <div class="summary">
    <div class="card"><div class="label">Products</div><div class="value">${rows.length}</div></div>
    <div class="card"><div class="label">Variant lines</div><div class="value">${variantLineCount}</div></div>
    <div class="card"><div class="label">Total units</div><div class="value">${totalUnits}</div></div>
    <div class="card low"><div class="label">Low stock</div><div class="value">${lowCount}</div></div>
    <div class="card out"><div class="label">Out of stock</div><div class="value">${outCount}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>SKU</th>
        <th>Category</th>
        <th>Variant</th>
        <th class="num">Stock</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:24px">No products match the current filters.</td></tr>'}
    </tbody>
  </table>
  <div class="footer">
    ${rows.length} product${rows.length !== 1 ? 's' : ''} listed.
    Low/out-of-stock flags and counts use each product's low-stock threshold (default 5),
    counted per variant for products that have variants and per product otherwise.
  </div>
</body>
</html>`;

      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
      } else {
        alert('Could not open the print window. Please allow pop-ups for this site and try again.');
      }
    } catch (err: any) {
      console.error('Print stock list error:', err);
      if (win) win.close();
      alert('Could not generate the stock list: ' + (err?.message || 'unknown error'));
    } finally {
      setPrinting(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id));
    }
  };

  const handleSelectProduct = (productId: string) => {
    if (selectedProducts.includes(productId)) {
      setSelectedProducts(selectedProducts.filter(id => id !== productId));
    } else {
      setSelectedProducts([...selectedProducts, productId]);
    }
  };

  const deleteProductWithRelations = async (productIds: string[]): Promise<{ message: string } | null> => {
    // Route through the authenticated server endpoint which wraps the
    // multi-table cleanup in a single SQL transaction and then removes
    // the associated storage objects.  No more half-deleted products.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/products/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ ids: productIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { message: body?.error || `Delete failed (${res.status})` };
      }
      return null;
    } catch (err: any) {
      return { message: err?.message || 'Delete failed' };
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      const error = await deleteProductWithRelations([productId]);
      if (!error) {
        setProducts(products.filter(p => p.id !== productId));
        alert('Product deleted successfully');
      } else {
        console.error('Delete error:', error);
        alert('Error deleting product: ' + error.message);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(`Are you sure you want to delete ${selectedProducts.length} products? This action cannot be undone.`)) {
      const error = await deleteProductWithRelations(selectedProducts);
      if (!error) {
        setProducts(products.filter(p => !selectedProducts.includes(p.id)));
        setSelectedProducts([]);
        alert('Products deleted successfully');
      } else {
        console.error('Bulk delete error:', error);
        alert('Error deleting products: ' + error.message);
      }
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedProducts.length === 0) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({ status: bulkStatus })
        .in('id', selectedProducts);

      if (error) throw error;

      setProducts(prev =>
        prev.map((p) => selectedProducts.includes(p.id) ? { ...p, status: bulkStatus } : p)
      );
      setSelectedProducts([]);
      alert(`Updated ${selectedProducts.length} product${selectedProducts.length > 1 ? 's' : ''} to ${bulkStatus}.`);
    } catch (err: any) {
      console.error('Bulk status update error:', err);
      alert('Error updating status: ' + err.message);
    }
  };

  const filteredProducts = products.filter(product => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = product.name.toLowerCase().includes(term) ||
      (product.sku && product.sku.toLowerCase().includes(term)) ||
      (product.category && product.category.toLowerCase().includes(term));
    const matchesCategory = !categoryFilter || product.category === categoryFilter;
    const matchesStatus = !statusFilter || product.status === statusFilter;
    const matchesVariants = !variantFilter
      || (variantFilter === 'with' && product.variantsCount > 0)
      || (variantFilter === 'without' && product.variantsCount === 0);
    const lowStockThreshold = product.metadata?.low_stock_threshold || 5;
    const matchesStock = stockFilter === 'all'
      || (stockFilter === 'out' && product.stock === 0)
      || (stockFilter === 'low' && product.stock > 0 && product.stock <= lowStockThreshold);
    return matchesSearch && matchesCategory && matchesStatus && matchesVariants && matchesStock;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-1">Manage your product catalog and inventory</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintStockList}
            disabled={printing || loading}
            className="px-5 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate a printable PDF of all products, variants and current stock"
          >
            <i className={`mr-2 ${printing ? 'ri-loader-4-line animate-spin' : 'ri-printer-line'}`}></i>
            {printing ? 'Preparing…' : 'Print stock list'}
          </button>
          <Link
            href="/admin/products/new"
            className="px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center md:items-start"
          >
            <i className="ri-add-line mr-2"></i>
            Add Product
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => {
            setStatusFilter('');
            setStockFilter('all');
          }}
          className="bg-white rounded-xl border-2 border-gray-200 p-4 text-left hover:border-blue-300 transition-colors cursor-pointer"
        >
          <p className="text-sm text-gray-600 mb-1">Total Products</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </button>
        <button
          onClick={() => {
            setStatusFilter('active');
            setStockFilter('all');
          }}
          className={`bg-white rounded-xl border-2 p-4 text-left transition-colors cursor-pointer ${statusFilter === 'active' && stockFilter === 'all' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
        >
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-blue-700">{stats.active}</p>
        </button>
        <button
          onClick={() => {
            setStatusFilter('');
            setStockFilter('low');
          }}
          className={`bg-white rounded-xl border-2 p-4 text-left transition-colors cursor-pointer ${stockFilter === 'low' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-amber-300'}`}
        >
          <p className="text-sm text-gray-600 mb-1">Low Stock</p>
          <p className="text-2xl font-bold text-amber-700">{stats.lowStock}</p>
        </button>
        <button
          onClick={() => {
            setStatusFilter('');
            setStockFilter('out');
          }}
          className={`bg-white rounded-xl border-2 p-4 text-left transition-colors cursor-pointer ${stockFilter === 'out' ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-red-300'}`}
        >
          <p className="text-sm text-gray-600 mb-1">Out of Stock</p>
          <p className="text-2xl font-bold text-red-700">{stats.outOfStock}</p>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg w-5 h-5 flex items-center justify-center"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products by name, SKU, or category..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors font-medium whitespace-nowrap cursor-pointer"
              >
                <i className="ri-filter-line mr-2"></i>
                Filters
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="name">Sort by Name</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="stock">Sort by Stock</option>
              </select>
              <div className="flex border-2 border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={`w-10 h-10 flex items-center justify-center transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-blue-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <i className="ri-list-check text-xl w-5 h-5 flex items-center justify-center"></i>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`w-10 h-10 flex items-center justify-center border-l-2 border-gray-300 transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-blue-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <i className="ri-grid-line text-xl w-5 h-5 flex items-center justify-center"></i>
                </button>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg grid md:grid-cols-5 gap-4">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 pr-8 border-2 border-gray-300 rounded-lg text-sm cursor-pointer"
              >
                <option value="">All Categories</option>
                {categories.map((cat: any) => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 pr-8 border-2 border-gray-300 rounded-lg text-sm cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
              <select
                value={variantFilter}
                onChange={(e) => setVariantFilter(e.target.value)}
                className="px-3 py-2 pr-8 border-2 border-gray-300 rounded-lg text-sm cursor-pointer"
              >
                <option value="">All Products</option>
                <option value="with">Only With Variants</option>
                <option value="without">Only Without Variants</option>
              </select>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as 'all' | 'low' | 'out')}
                className="px-3 py-2 pr-8 border-2 border-gray-300 rounded-lg text-sm cursor-pointer"
              >
                <option value="all">All Stock Levels</option>
                <option value="low">Low Stock Only</option>
                <option value="out">Out of Stock Only</option>
              </select>
            </div>
          )}
        </div>

        {selectedProducts.length > 0 && (
          <div className="p-4 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
            <p className="text-blue-800 font-semibold">
              {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center space-x-2">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="px-3 py-2 pr-8 border border-blue-200 rounded-lg text-sm bg-white cursor-pointer"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              <button
                onClick={handleBulkStatusUpdate}
                className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors whitespace-nowrap cursor-pointer"
              >
                Update Status
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <i className="ri-loader-4-line animate-spin text-3xl mb-2 inline-block"></i>
            <p>Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <i className="ri-inbox-line text-4xl mb-4 text-gray-300 inline-block"></i>
            <p className="text-lg">No products found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-4 px-6">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === products.length && products.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Product</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">SKU</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Category</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Price</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Stock</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{product.name}</p>
                          <div className="flex items-center mt-1">
                            <span className="text-xs text-gray-400">ID: {product.id.substring(0, 8)}...</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-700 text-sm font-mono">{product.sku || '-'}</td>
                    <td className="py-4 px-4 text-gray-700 text-sm">{product.category}</td>
                    <td className="py-4 px-4 font-semibold text-gray-900 whitespace-nowrap">GH₵ {product.price.toFixed(2)}</td>
                    <td className="py-4 px-4 text-gray-700">
                      {product.stock}
                      {product.stock <= (product.metadata?.low_stock_threshold || 5) && product.stock > 0 && (
                        <span className="ml-2 w-2 h-2 rounded-full bg-amber-500 inline-block" title="Low Stock"></span>
                      )}
                      {product.stock === 0 && (
                        <span className="ml-2 w-2 h-2 rounded-full bg-red-500 inline-block" title="Out of Stock"></span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap capitalize ${statusColors[product.status] || 'bg-gray-100 text-gray-600'}`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/admin/products/${product.id}`}
                          onClick={saveScrollForReturn}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <i className="ri-edit-line text-lg"></i>
                        </Link>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <i className="ri-delete-bin-line text-lg"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div key={product.id} className="border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={() => handleSelectProduct(product.id)}
                    className="absolute top-2 left-2 w-5 h-5 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer z-10"
                  />
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3 border border-gray-200">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                </div>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mb-2 capitalize ${statusColors[product.status] || 'bg-gray-100 text-gray-600'}`}>
                  {product.status}
                </span>
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{product.category}</p>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-lg font-bold text-gray-900">GH₵ {product.price}</p>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-3 pb-3 border-b border-gray-200">
                  <span>Stock: {product.stock}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Link
                    href={`/admin/products/${product.id}`}
                    onClick={saveScrollForReturn}
                    className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg text-sm font-medium text-center transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="w-9 h-9 flex items-center justify-center border-2 border-gray-300 text-gray-700 hover:border-red-600 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {filteredProducts.length === 0 ? 'No products' : `Showing ${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>
    </div>
  );
}
