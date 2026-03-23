'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import JsBarcode from 'jsbarcode';

function generateBarcode(): string {
    const prefix = '200';
    const body = prefix + Date.now().toString().slice(-9);
    const digits = body.split('').map(Number);
    let sum = 0;
    digits.forEach((d, i) => { sum += d * (i % 2 === 0 ? 1 : 3); });
    const check = (10 - (sum % 10)) % 10;
    return body + check;
}

interface Product {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    price: number;
    quantity: number;
    category_name?: string;
    image_url?: string;
}

function BarcodeImage({ value, width = 1.5, height = 50 }: { value: string; width?: number; height?: number }) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (svgRef.current && value) {
            try {
                JsBarcode(svgRef.current, value, {
                    format: 'EAN13',
                    width,
                    height,
                    displayValue: true,
                    fontSize: 12,
                    margin: 5,
                    background: '#ffffff',
                });
            } catch {
                try {
                    JsBarcode(svgRef.current, value, {
                        format: 'CODE128',
                        width,
                        height,
                        displayValue: true,
                        fontSize: 12,
                        margin: 5,
                        background: '#ffffff',
                    });
                } catch {
                    // fallback: leave empty
                }
            }
        }
    }, [value, width, height]);

    if (!value) return <span className="text-gray-400 text-sm italic">No barcode</span>;
    return <svg ref={svgRef} />;
}

export default function BarcodesPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'with' | 'without'>('all');
    const printRef = useRef<HTMLDivElement>(null);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select('id, name, sku, barcode, price, quantity, categories(name), product_images(url, position)')
            .eq('status', 'active')
            .order('name');

        if (!error && data) {
            setProducts(data.map((p: any) => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                barcode: p.barcode,
                price: p.price,
                quantity: p.quantity,
                category_name: p.categories?.name || '',
                image_url: p.product_images?.sort((a: any, b: any) => a.position - b.position)?.[0]?.url || '',
            })));
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    const generateForAll = async () => {
        const missing = products.filter(p => !p.barcode);
        if (missing.length === 0) return;

        setGenerating(true);
        const used = new Set(products.filter(p => p.barcode).map(p => p.barcode!));

        for (const product of missing) {
            let code: string;
            do { code = generateBarcode(); } while (used.has(code));
            used.add(code);

            await supabase.from('products').update({ barcode: code }).eq('id', product.id);
            await new Promise(r => setTimeout(r, 50));
        }

        await fetchProducts();
        setGenerating(false);
    };

    const generateForOne = async (productId: string) => {
        const used = new Set(products.filter(p => p.barcode).map(p => p.barcode!));
        let code: string;
        do { code = generateBarcode(); } while (used.has(code));

        await supabase.from('products').update({ barcode: code }).eq('id', productId);
        await fetchProducts();
    };

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selected.size === filtered.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filtered.map(p => p.id)));
        }
    };

    const filtered = products.filter(p => {
        const matchesSearch = !searchQuery ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.barcode?.includes(searchQuery);
        const matchesFilter =
            filter === 'all' ? true :
            filter === 'with' ? !!p.barcode :
            !p.barcode;
        return matchesSearch && matchesFilter;
    });

    const handlePrint = () => {
        const toPrint = selected.size > 0
            ? products.filter(p => selected.has(p.id) && p.barcode)
            : filtered.filter(p => p.barcode);

        if (toPrint.length === 0) {
            alert('No products with barcodes to print. Generate barcodes first.');
            return;
        }

        const totalLabels = toPrint.reduce((sum, p) => sum + Math.max(p.quantity, 1), 0);
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html><head>
            <title>Barcode Labels - Discount Discovery Zone</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; background: #fff; }
                @media print {
                    @page { margin: 5mm; size: A4; }
                    .no-print { display: none !important; }
                    .product-section { page-break-inside: avoid; break-inside: avoid; }
                    .product-section:not(:first-of-type) { page-break-before: always; }
                }
                .toolbar {
                    padding: 12px; text-align: center;
                    background: #f5f5f5; border-bottom: 1px solid #ddd;
                    position: sticky; top: 0; z-index: 10;
                }
                .toolbar button {
                    padding: 10px 24px; background: #2563eb; color: white;
                    border: none; border-radius: 8px; font-size: 14px;
                    font-weight: 600; cursor: pointer; margin: 0 4px;
                }
                .toolbar button:hover { background: #1d4ed8; }
                .store-header {
                    padding: 16px; text-align: center;
                    border-bottom: 2px solid #333; margin-bottom: 16px;
                }
                .store-header h1 { font-size: 18px; margin-bottom: 2px; }
                .store-header p { font-size: 11px; color: #666; }
                .product-section {
                    border: 2px solid #e5e7eb; border-radius: 12px;
                    margin: 16px 12px; overflow: hidden;
                }
                .product-header {
                    display: flex; align-items: center; gap: 16px;
                    padding: 16px; background: #f9fafb;
                    border-bottom: 2px solid #e5e7eb;
                }
                .product-img {
                    width: 80px; height: 80px; object-fit: cover;
                    border-radius: 8px; border: 1px solid #e5e7eb;
                    flex-shrink: 0;
                }
                .product-img-placeholder {
                    width: 80px; height: 80px; border-radius: 8px;
                    background: #f3f4f6; display: flex; align-items: center;
                    justify-content: center; color: #9ca3af; font-size: 28px;
                    flex-shrink: 0;
                }
                .product-info h2 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
                .product-info .meta { font-size: 12px; color: #6b7280; }
                .product-info .meta span { margin-right: 12px; }
                .product-info .price-tag {
                    font-size: 18px; font-weight: 800; color: #1d4ed8; margin-top: 4px;
                }
                .barcode-grid {
                    display: grid; grid-template-columns: repeat(4, 1fr);
                    gap: 4px; padding: 8px;
                }
                .barcode-cell {
                    border: 1px solid #e5e7eb; border-radius: 6px;
                    padding: 6px 4px; text-align: center;
                    break-inside: avoid;
                }
                .barcode-cell .lbl-name {
                    font-size: 8px; font-weight: 700; line-height: 1.1;
                    margin-bottom: 2px; white-space: nowrap;
                    overflow: hidden; text-overflow: ellipsis;
                }
                .barcode-cell svg { max-width: 100%; height: auto; }
                .barcode-cell .lbl-price {
                    font-size: 10px; font-weight: 800; margin-top: 2px;
                }
                .qty-badge {
                    display: inline-block; background: #dbeafe; color: #1e40af;
                    font-size: 11px; font-weight: 700; padding: 2px 8px;
                    border-radius: 9999px;
                }
            </style>
            </head><body>
            <div class="no-print toolbar">
                <button onclick="window.print()">Print All Barcodes</button>
                <button onclick="window.close()">Close</button>
            </div>
            <div class="store-header">
                <h1>Discount Discovery Zone</h1>
                <p>${toPrint.length} products &middot; ${totalLabels} total labels &middot; ${new Date().toLocaleDateString()}</p>
            </div>
            <div id="products-container"></div>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3/dist/JsBarcode.all.min.js"><\/script>
            <script>
                const products = ${JSON.stringify(toPrint.map(p => ({
                    name: p.name,
                    barcode: p.barcode,
                    price: p.price,
                    quantity: p.quantity,
                    sku: p.sku,
                    image: p.image_url
                })))};
                const container = document.getElementById('products-container');

                products.forEach(p => {
                    const qty = Math.max(p.quantity, 1);
                    const section = document.createElement('div');
                    section.className = 'product-section';

                    // Product header with image and info
                    const header = document.createElement('div');
                    header.className = 'product-header';
                    if (p.image) {
                        header.innerHTML = '<img class="product-img" src="' + p.image + '" alt="" />';
                    } else {
                        header.innerHTML = '<div class="product-img-placeholder">&#128722;</div>';
                    }
                    header.innerHTML += '<div class="product-info">' +
                        '<h2>' + p.name + '</h2>' +
                        '<div class="meta"><span>SKU: ' + (p.sku || '—') + '</span><span>Barcode: ' + p.barcode + '</span></div>' +
                        '<div class="price-tag">GH\\u20B5 ' + Number(p.price).toFixed(2) + '</div>' +
                        '<div style="margin-top:4px"><span class="qty-badge">' + qty + ' labels (matches stock)</span></div>' +
                    '</div>';
                    section.appendChild(header);

                    // Barcode grid
                    const grid = document.createElement('div');
                    grid.className = 'barcode-grid';
                    for (let i = 0; i < qty; i++) {
                        const cell = document.createElement('div');
                        cell.className = 'barcode-cell';
                        const nameEl = document.createElement('div');
                        nameEl.className = 'lbl-name';
                        nameEl.textContent = p.name;
                        cell.appendChild(nameEl);
                        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                        cell.appendChild(svg);
                        try {
                            JsBarcode(svg, p.barcode, { format: 'EAN13', width: 1.2, height: 32, displayValue: true, fontSize: 10, margin: 2, background: '#ffffff' });
                        } catch(e) {
                            try { JsBarcode(svg, p.barcode, { format: 'CODE128', width: 1.2, height: 32, displayValue: true, fontSize: 10, margin: 2, background: '#ffffff' }); } catch(e2) {}
                        }
                        const priceEl = document.createElement('div');
                        priceEl.className = 'lbl-price';
                        priceEl.textContent = 'GH\\u20B5 ' + Number(p.price).toFixed(2);
                        cell.appendChild(priceEl);
                        grid.appendChild(cell);
                    }
                    section.appendChild(grid);
                    container.appendChild(section);
                });
            <\/script>
            </body></html>
        `);
        printWindow.document.close();
    };

    const missingCount = products.filter(p => !p.barcode).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin/products" className="w-10 h-10 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                        <i className="ri-arrow-left-line text-xl text-gray-700"></i>
                    </Link>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Barcode Manager</h1>
                        <p className="text-gray-600 mt-1">Generate, view and print barcodes for your products</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {missingCount > 0 && (
                        <button
                            onClick={generateForAll}
                            disabled={generating}
                            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                        >
                            {generating ? (
                                <><i className="ri-loader-4-line animate-spin"></i> Generating...</>
                            ) : (
                                <><i className="ri-barcode-line"></i> Generate All Missing ({missingCount})</>
                            )}
                        </button>
                    )}
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold text-sm transition-colors cursor-pointer"
                    >
                        <i className="ri-printer-line"></i>
                        Print {selected.size > 0 ? `Selected (${selected.size})` : 'All'}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Total Products</p>
                    <p className="text-2xl font-bold text-gray-900">{products.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">With Barcode</p>
                    <p className="text-2xl font-bold text-green-600">{products.filter(p => p.barcode).length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Missing Barcode</p>
                    <p className="text-2xl font-bold text-amber-600">{missingCount}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Selected</p>
                    <p className="text-2xl font-bold text-blue-600">{selected.size}</p>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, SKU, or barcode..."
                            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        {(['all', 'with', 'without'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${filter === f ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                            >
                                {f === 'all' ? 'All' : f === 'with' ? 'Has Barcode' : 'No Barcode'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <i className="ri-loader-4-line animate-spin text-3xl text-blue-600"></i>
                        <p className="text-gray-500 mt-3">Loading products...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <i className="ri-barcode-line text-5xl text-gray-300"></i>
                        <p className="text-gray-600 mt-3 font-semibold">No products found</p>
                    </div>
                ) : (
                    <>
                        {/* Table Header */}
                        <div className="hidden lg:grid grid-cols-[40px_1fr_180px_1fr_120px_80px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                            <div>
                                <input
                                    type="checkbox"
                                    checked={selected.size === filtered.length && filtered.length > 0}
                                    onChange={selectAll}
                                    className="w-4 h-4 cursor-pointer"
                                />
                            </div>
                            <div>Product</div>
                            <div>SKU</div>
                            <div>Barcode</div>
                            <div>Price</div>
                            <div></div>
                        </div>

                        {/* Rows */}
                        <div ref={printRef} className="divide-y divide-gray-100">
                            {filtered.map(product => (
                                <div key={product.id} className="grid grid-cols-1 lg:grid-cols-[40px_1fr_180px_1fr_120px_80px] gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors">
                                    <div>
                                        <input
                                            type="checkbox"
                                            checked={selected.has(product.id)}
                                            onChange={() => toggleSelect(product.id)}
                                            className="w-4 h-4 cursor-pointer"
                                        />
                                    </div>

                                    <div className="flex items-center gap-3 min-w-0">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                <i className="ri-image-line text-gray-400"></i>
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 truncate">{product.name}</p>
                                            {product.category_name && (
                                                <p className="text-xs text-gray-500">{product.category_name}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <span className="font-mono text-sm text-gray-600">{product.sku || '—'}</span>
                                    </div>

                                    <div>
                                        {product.barcode ? (
                                            <BarcodeImage value={product.barcode} width={1.2} height={35} />
                                        ) : (
                                            <button
                                                onClick={() => generateForOne(product.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
                                            >
                                                <i className="ri-add-line"></i> Generate Barcode
                                            </button>
                                        )}
                                    </div>

                                    <div>
                                        <span className="font-semibold text-gray-900">GH₵ {Number(product.price).toFixed(2)}</span>
                                    </div>

                                    <div>
                                        <Link
                                            href={`/admin/products/${product.id}`}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            Edit
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
