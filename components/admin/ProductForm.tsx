'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface ProductFormProps {
    initialData?: any;
    isEditMode?: boolean;
}

interface VariantRow {
    tempId: string;
    name: string;
    appearanceType: 'color' | 'image';
    colorName: string;
    colorHex: string;
    imageUrl: string;
    price: string;
    stock: string;
    sku: string;
}

export default function ProductForm({ initialData, isEditMode = false }: ProductFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);

    const [productName, setProductName] = useState(initialData?.name || '');
    const [categoryId, setCategoryId] = useState(initialData?.category_id || '');
    const [price, setPrice] = useState(initialData?.price || '');
    const [comparePrice, setComparePrice] = useState(initialData?.compare_at_price || '');
    const [sku, setSku] = useState(initialData?.sku || '');
    const [barcode, setBarcode] = useState(initialData?.barcode || '');
    const [stock, setStock] = useState(initialData?.quantity || '');
    const [moq, setMoq] = useState(initialData?.moq || '1');
    const [lowStockThreshold, setLowStockThreshold] = useState(initialData?.metadata?.low_stock_threshold || '5');
    const [description, setDescription] = useState(initialData?.description || '');
    const [status, setStatus] = useState(initialData?.status || 'Active');
    const [featured, setFeatured] = useState(initialData?.featured || false);
    const [preorderShipping, setPreorderShipping] = useState(initialData?.metadata?.preorder_shipping || '');
    const [activeTab, setActiveTab] = useState('general');

    const generateSku = () => {
        const prefix = 'DDZ';
        const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${timestamp}-${random}`;
    };

    const generateBarcode = () => {
        const prefix = '200';
        const body = prefix + Date.now().toString().slice(-9);
        const digits = body.split('').map(Number);
        let sum = 0;
        digits.forEach((d, i) => { sum += d * (i % 2 === 0 ? 1 : 3); });
        const check = (10 - (sum % 10)) % 10;
        return body + check;
    };

    // --- Variant System (row-based) ---
    const makeEmptyRow = (): VariantRow => ({
        tempId: Math.random().toString(36).slice(2),
        name: '',
        appearanceType: 'color',
        colorName: '',
        colorHex: '#888888',
        imageUrl: '',
        price: '',
        stock: '0',
        sku: ''
    });

    const [variantRows, setVariantRows] = useState<VariantRow[]>(() => {
        const existingVariants = initialData?.product_variants || [];
        const allImages = initialData?.product_images || [];
        if (existingVariants.length === 0) return [];
        return existingVariants.map((v: any) => {
            const variantImg = allImages.find((img: any) => img.variant_id === v.id);
            const colorName = v.option2 || '';
            const colorHex = v.metadata?.color_hex || '#888888';
            const hasImage = !!variantImg?.url;
            return {
                tempId: v.id || Math.random().toString(36).slice(2),
                name: v.name || v.option1 || '',
                appearanceType: (hasImage ? 'image' : 'color') as 'color' | 'image',
                colorName,
                colorHex,
                imageUrl: variantImg?.url || '',
                price: v.price?.toString() || '',
                stock: (v.stock ?? v.quantity ?? 0).toString(),
                sku: v.sku || ''
            };
        });
    });

    const [uploadingVariantId, setUploadingVariantId] = useState<string | null>(null);

    const updateRow = (tempId: string, field: keyof VariantRow, value: string) => {
        setVariantRows(prev => prev.map(r => r.tempId === tempId ? { ...r, [field]: value } : r));
    };

    const addVariantRow = () => setVariantRows(prev => [...prev, makeEmptyRow()]);
    const removeVariantRow = (tempId: string) => setVariantRows(prev => prev.filter(r => r.tempId !== tempId));

    const bulkSetVariantField = (field: 'price' | 'stock', value: string) => {
        setVariantRows(prev => prev.map(r => ({ ...r, [field]: value })));
    };

    const handleVariantImageUpload = async (tempId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setUploadingVariantId(tempId);
        try {
            const file = e.target.files[0];
            const fileName = `variants/${Math.random().toString(36).slice(2)}.${file.name.split('.').pop()}`;
            const { error } = await supabase.storage.from('products').upload(fileName, file);
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
            updateRow(tempId, 'imageUrl', publicUrl);
        } catch (err: any) {
            alert('Upload failed: ' + err.message);
        } finally {
            setUploadingVariantId(null);
        }
    };

    // Product-level images (not linked to any variant)
    const [images, setImages] = useState<any[]>(
        (initialData?.product_images || []).filter((img: any) => !img.variant_id)
    );
    const [uploading, setUploading] = useState(false);

    // SEO
    const [seoTitle, setSeoTitle] = useState(initialData?.seo_title || '');
    const [metaDescription, setMetaDescription] = useState(initialData?.seo_description || '');
    const [urlSlug, setUrlSlug] = useState(initialData?.slug || '');
    const [keywords, setKeywords] = useState(initialData?.tags?.join(', ') || '');

    const tabs = [
        { id: 'general', label: 'General', icon: 'ri-information-line' },
        { id: 'pricing', label: 'Pricing & Inventory', icon: 'ri-price-tag-3-line' },
        { id: 'variants', label: 'Variants', icon: 'ri-layout-grid-line' },
        { id: 'images', label: 'Images', icon: 'ri-image-line' },
        { id: 'seo', label: 'SEO', icon: 'ri-search-line' }
    ];

    useEffect(() => {
        async function fetchCategories() {
            const { data } = await supabase.from('categories').select('id, name').eq('status', 'active');
            if (data) {
                setCategories(data);
                if (data.length > 0 && !categoryId) setCategoryId(data[0].id);
            }
        }
        fetchCategories();
    }, [categoryId]);

    useEffect(() => {
        if (!isEditMode && productName && !urlSlug) {
            setUrlSlug(productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
        }
    }, [productName, isEditMode, urlSlug]);

    useEffect(() => {
        if (!isEditMode && !sku) setSku(generateSku());
        if (!isEditMode && !barcode) setBarcode(generateBarcode());
    }, [isEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!e.target.files || e.target.files.length === 0) return;
            setUploading(true);
            const files = Array.from(e.target.files);
            const uploaded: { url: string; position: number }[] = [];
            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).slice(2)}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('products').upload(fileName, file);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
                uploaded.push({ url: publicUrl, position: images.length + uploaded.length });
            }
            setImages(prev => [...prev, ...uploaded]);
        } catch (error: any) {
            alert('Error uploading image: ' + error.message);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setImages(images.filter((_, idx) => idx !== indexToRemove));
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);

            const hasVariants = variantRows.length > 0;
            const variantStockTotal = hasVariants
                ? variantRows.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)
                : parseInt(stock) || 0;

            const productData = {
                name: productName,
                slug: urlSlug || productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
                description,
                category_id: categoryId || null,
                price: parseFloat(price) || 0,
                compare_at_price: comparePrice ? parseFloat(comparePrice) : null,
                sku: sku || generateSku(),
                barcode: barcode || generateBarcode(),
                quantity: hasVariants ? variantStockTotal : (parseInt(stock) || 0),
                moq: parseInt(moq) || 1,
                status: status.toLowerCase(),
                featured,
                seo_title: seoTitle,
                seo_description: metaDescription,
                tags: (keywords as string).split(',').map((k: string) => k.trim()).filter(Boolean),
                metadata: {
                    low_stock_threshold: parseInt(lowStockThreshold) || 5,
                    preorder_shipping: preorderShipping.trim() || null,
                }
            };

            let productId = initialData?.id;
            let error;

            if (isEditMode && productId) {
                const { error: updateError } = await supabase.from('products').update(productData).eq('id', productId);
                error = updateError;
            } else {
                const { data: newProduct, error: insertError } = await supabase.from('products').insert([productData]).select().single();
                if (newProduct) productId = newProduct.id;
                error = insertError;
            }

            if (error) throw error;

            if (productId) {
                if (isEditMode) {
                    await supabase.from('product_images').delete().eq('product_id', productId);
                    await supabase.from('product_variants').delete().eq('product_id', productId);
                }

                // 1. Insert variant rows
                const imageInserts: any[] = [];

                if (hasVariants) {
                    const variantInserts = variantRows.map(v => ({
                        product_id: productId,
                        name: v.name || v.colorName || 'Default',
                        sku: v.sku || null,
                        price: parseFloat(v.price) || 0,
                        quantity: parseInt(v.stock) || 0,
                        option1: v.name || null,
                        option2: v.colorName?.trim() || null,
                        metadata: v.colorHex && v.appearanceType === 'color' ? { color_hex: v.colorHex } : {}
                    }));

                    const { data: insertedVariants, error: varError } = await supabase
                        .from('product_variants').insert(variantInserts).select();
                    if (varError) throw varError;

                    // Link variant images to the inserted variant IDs
                    (insertedVariants || []).forEach((iv: any, idx: number) => {
                        const row = variantRows[idx];
                        if (row?.imageUrl) {
                            imageInserts.push({
                                product_id: productId,
                                url: row.imageUrl,
                                position: 0,
                                alt_text: row.name || row.colorName || productName,
                                variant_id: iv.id
                            });
                        }
                    });
                }

                // 2. Product-level images
                images.forEach((img, idx) => {
                    imageInserts.push({
                        product_id: productId,
                        url: img.url,
                        position: idx,
                        alt_text: productName,
                        variant_id: null
                    });
                });

                if (imageInserts.length > 0) {
                    const { error: imgError } = await supabase.from('product_images').insert(imageInserts);
                    if (imgError) throw imgError;
                }
            }

            alert(isEditMode ? 'Product updated successfully!' : 'Product created successfully!');
            router.push('/admin/products');

        } catch (err: any) {
            console.error('Error saving product:', err);
            alert(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link
                        href="/admin/products"
                        className="w-10 h-10 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                    >
                        <i className="ri-arrow-left-line text-xl text-gray-700"></i>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {isEditMode ? 'Edit Product' : 'Add New Product'}
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {isEditMode ? 'Update product information and settings' : 'Create a new product for your catalog'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {isEditMode && (
                        <Link
                            href={`/product/${initialData?.id}`}
                            target="_blank"
                            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors font-semibold whitespace-nowrap cursor-pointer flex items-center"
                        >
                            <i className="ri-eye-line mr-2"></i>
                            Preview
                        </Link>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? (
                            <><i className="ri-loader-4-line animate-spin mr-2"></i>Saving...</>
                        ) : (
                            <><i className="ri-save-line mr-2"></i>{isEditMode ? 'Save Changes' : 'Create Product'}</>
                        )}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-200 overflow-x-auto">
                    <div className="flex">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 px-6 py-4 font-semibold whitespace-nowrap transition-colors border-b-2 cursor-pointer ${activeTab === tab.id
                                    ? 'border-blue-700 text-blue-700 bg-blue-50'
                                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    }`}
                            >
                                <i className={`${tab.icon} text-xl`}></i>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-8">
                    {/* ── GENERAL TAB ── */}
                    {activeTab === 'general' && (
                        <div className="space-y-6 max-w-3xl">
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">Product Name *</label>
                                <input
                                    type="text"
                                    value={productName}
                                    onChange={(e) => setProductName(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Enter product name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={6}
                                    maxLength={500}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    placeholder="Describe your product..."
                                />
                                <p className="text-sm text-gray-500 mt-2">{description.length}/500 characters</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">Category *</label>
                                    <select
                                        value={categoryId}
                                        onChange={(e) => setCategoryId(e.target.value)}
                                        className="w-full px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                                    >
                                        {categories.length === 0 && <option value="">Loading categories...</option>}
                                        {categories.length > 0 && <option value="">Select a category</option>}
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">Status</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                                    >
                                        <option>Active</option>
                                        <option>Draft</option>
                                        <option>Archived</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                <input
                                    type="checkbox"
                                    checked={featured}
                                    onChange={(e) => setFeatured(e.target.checked)}
                                    className="w-5 h-5 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                />
                                <label className="text-gray-900 font-medium">Feature this product on homepage</label>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">Pre-order / Estimated Shipping</label>
                                <input
                                    type="text"
                                    value={preorderShipping}
                                    onChange={(e) => setPreorderShipping(e.target.value)}
                                    placeholder="e.g., Ships in 14 days, Available March 15"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                                <p className="text-xs text-gray-500 mt-1">Leave empty if product ships immediately.</p>
                            </div>
                        </div>
                    )}

                    {/* ── PRICING TAB ── */}
                    {activeTab === 'pricing' && (
                        <div className="space-y-6 max-w-3xl">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">Price (GH₵) *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">GH₵</span>
                                        <input
                                            type="number"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            className="w-full pl-16 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            step="0.01" placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">Compare at Price (GH₵)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">GH₵</span>
                                        <input
                                            type="number"
                                            value={comparePrice}
                                            onChange={(e) => setComparePrice(e.target.value)}
                                            className="w-full pl-16 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            step="0.01" placeholder="0.00"
                                        />
                                    </div>
                                    <p className="text-sm text-gray-500 mt-2">Show original price for comparison</p>
                                </div>
                            </div>

                            {price && comparePrice && parseFloat(comparePrice) > parseFloat(price) && (
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-blue-900 font-semibold mb-1">Discount Calculation</p>
                                    <p className="text-blue-800">
                                        Savings: GH₵ {(parseFloat(comparePrice) - parseFloat(price)).toFixed(2)}
                                        <span className="ml-2">({(((parseFloat(comparePrice) - parseFloat(price)) / parseFloat(comparePrice)) * 100).toFixed(0)}% off)</span>
                                    </p>
                                </div>
                            )}

                            <div className="pt-6 border-t border-gray-200">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Inventory</h3>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">SKU (Auto-generated)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={sku}
                                                onChange={(e) => setSku(e.target.value)}
                                                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono bg-gray-50"
                                                readOnly
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setSku(generateSku())}
                                                className="px-4 py-3 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
                                            >
                                                <i className="ri-refresh-line text-lg"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">Barcode (EAN-13)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={barcode}
                                                onChange={(e) => setBarcode(e.target.value)}
                                                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono bg-gray-50"
                                                readOnly
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setBarcode(generateBarcode())}
                                                className="px-4 py-3 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
                                                title="Generate new barcode"
                                            >
                                                <i className="ri-refresh-line text-lg"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6 mt-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">Stock Quantity *</label>
                                        {variantRows.length > 0 ? (
                                            <div>
                                                <input
                                                    type="number"
                                                    value={variantRows.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)}
                                                    readOnly
                                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                                />
                                                <p className="text-sm text-amber-600 mt-1 flex items-center">
                                                    <i className="ri-information-line mr-1"></i>
                                                    Stock is managed per variant in the Variants tab.
                                                </p>
                                            </div>
                                        ) : (
                                            <input
                                                type="number"
                                                value={stock}
                                                onChange={(e) => setStock(e.target.value)}
                                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="0"
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6 mt-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">Minimum Order Quantity (MOQ)</label>
                                        <input
                                            type="number"
                                            value={moq}
                                            onChange={(e) => setMoq(e.target.value)}
                                            min="1"
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">Low Stock Threshold</label>
                                        <input
                                            type="number"
                                            value={lowStockThreshold}
                                            onChange={(e) => setLowStockThreshold(e.target.value)}
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── VARIANTS TAB ── */}
                    {activeTab === 'variants' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Product Variants</h3>
                                    <p className="text-gray-600 mt-1 text-sm">Manage sizes, colors, designs, or other versions of this product</p>
                                </div>
                                <button
                                    onClick={addVariantRow}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors cursor-pointer"
                                >
                                    <i className="ri-add-line text-lg"></i>
                                    Add Variant
                                </button>
                            </div>

                            {variantRows.length === 0 ? (
                                <div className="p-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                    <i className="ri-layout-grid-line text-5xl text-gray-300 mb-3 block"></i>
                                    <p className="font-semibold text-gray-600 text-lg">No variants yet</p>
                                    <p className="text-sm text-gray-500 mt-1 mb-4">Add variants for different sizes, colors, designs — anything that creates a separate version of this product.</p>
                                    <button
                                        onClick={addVariantRow}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors cursor-pointer"
                                    >
                                        <i className="ri-add-line"></i>
                                        Add First Variant
                                    </button>
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    {/* Bulk actions */}
                                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-wrap">
                                        <span className="text-sm font-semibold text-gray-700">{variantRows.length} variant{variantRows.length !== 1 ? 's' : ''}</span>
                                        <div className="flex gap-2 ml-auto">
                                            <button
                                                onClick={() => {
                                                    const val = prompt('Set price for ALL variants:', price?.toString() || '0');
                                                    if (val !== null) bulkSetVariantField('price', val);
                                                }}
                                                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                                            >
                                                Bulk Set Price
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const val = prompt('Set stock for ALL variants:', '0');
                                                    if (val !== null) bulkSetVariantField('stock', val);
                                                }}
                                                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                                            >
                                                Bulk Set Stock
                                            </button>
                                        </div>
                                    </div>

                                    {/* Table header */}
                                    <div className="hidden sm:grid grid-cols-[2fr_2fr_1.5fr_1.5fr_40px] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                        <span>Variant Name</span>
                                        <span>Appearance</span>
                                        <span>Price (GH₵)</span>
                                        <span>Stock</span>
                                        <span></span>
                                    </div>

                                    {/* Rows */}
                                    <div className="divide-y divide-gray-100">
                                        {variantRows.map((row) => (
                                            <div key={row.tempId} className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1.5fr_1.5fr_40px] gap-3 px-4 py-4 items-center hover:bg-gray-50 transition-colors">

                                                {/* Name */}
                                                <div>
                                                    <label className="text-xs font-semibold text-gray-500 sm:hidden mb-1 block">Variant Name</label>
                                                    <input
                                                        type="text"
                                                        value={row.name}
                                                        onChange={(e) => updateRow(row.tempId, 'name', e.target.value)}
                                                        placeholder="e.g. Red, XL, 128GB, Floral..."
                                                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                    />
                                                </div>

                                                {/* Appearance */}
                                                <div>
                                                    <label className="text-xs font-semibold text-gray-500 sm:hidden mb-1 block">Appearance</label>
                                                    <div className="flex flex-col gap-2">
                                                        {/* Toggle */}
                                                        <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
                                                            <button
                                                                onClick={() => updateRow(row.tempId, 'appearanceType', 'color')}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${row.appearanceType === 'color' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                                            >
                                                                <i className="ri-palette-line"></i> Color
                                                            </button>
                                                            <button
                                                                onClick={() => updateRow(row.tempId, 'appearanceType', 'image')}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${row.appearanceType === 'image' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                                            >
                                                                <i className="ri-image-line"></i> Image
                                                            </button>
                                                        </div>

                                                        {/* Color inputs */}
                                                        {row.appearanceType === 'color' && (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="color"
                                                                    value={row.colorHex}
                                                                    onChange={(e) => updateRow(row.tempId, 'colorHex', e.target.value)}
                                                                    className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer p-0.5 flex-shrink-0"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={row.colorName}
                                                                    onChange={(e) => updateRow(row.tempId, 'colorName', e.target.value)}
                                                                    placeholder="e.g. Red"
                                                                    className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs min-w-0"
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Image upload */}
                                                        {row.appearanceType === 'image' && (
                                                            <div className="flex items-center gap-2">
                                                                {row.imageUrl ? (
                                                                    <div className="relative w-12 h-12 flex-shrink-0">
                                                                        <img src={row.imageUrl} alt="variant" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                                                                        <button
                                                                            onClick={() => updateRow(row.tempId, 'imageUrl', '')}
                                                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] cursor-pointer hover:bg-red-600"
                                                                        >
                                                                            <i className="ri-close-line"></i>
                                                                        </button>
                                                                    </div>
                                                                ) : null}
                                                                <label className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-500 hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer ${uploadingVariantId === row.tempId ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                                    {uploadingVariantId === row.tempId ? (
                                                                        <><i className="ri-loader-4-line animate-spin"></i> Uploading...</>
                                                                    ) : (
                                                                        <><i className="ri-upload-2-line"></i> {row.imageUrl ? 'Change' : 'Upload'}</>
                                                                    )}
                                                                    <input
                                                                        type="file"
                                                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                                                        className="hidden"
                                                                        disabled={uploadingVariantId !== null}
                                                                        onChange={(e) => handleVariantImageUpload(row.tempId, e)}
                                                                    />
                                                                </label>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Price */}
                                                <div>
                                                    <label className="text-xs font-semibold text-gray-500 sm:hidden mb-1 block">Price (GH₵)</label>
                                                    <input
                                                        type="number"
                                                        value={row.price}
                                                        onChange={(e) => updateRow(row.tempId, 'price', e.target.value)}
                                                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                        step="0.01"
                                                        placeholder={price?.toString() || '0.00'}
                                                    />
                                                </div>

                                                {/* Stock */}
                                                <div>
                                                    <label className="text-xs font-semibold text-gray-500 sm:hidden mb-1 block">Stock</label>
                                                    <input
                                                        type="number"
                                                        value={row.stock}
                                                        onChange={(e) => updateRow(row.tempId, 'stock', e.target.value)}
                                                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                        placeholder="0"
                                                    />
                                                </div>

                                                {/* Delete */}
                                                <button
                                                    onClick={() => removeVariantRow(row.tempId)}
                                                    className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <i className="ri-delete-bin-line text-lg"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
                                        <p className="text-xs text-blue-800 flex items-center">
                                            <i className="ri-information-line mr-1.5"></i>
                                            Total stock: <strong className="ml-1">{variantRows.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)}</strong>
                                        </p>
                                        <button
                                            onClick={addVariantRow}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 cursor-pointer"
                                        >
                                            <i className="ri-add-line"></i> Add another
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-sm text-amber-800">
                                    <i className="ri-lightbulb-line mr-1.5"></i>
                                    <strong>Tip:</strong> Use <strong>Image</strong> appearance to upload a photo for each variant. When a customer selects that variant on the product page, the gallery will switch to show that image.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── IMAGES TAB ── */}
                    {activeTab === 'images' && (
                        <div className="space-y-8">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">Product Images</h3>
                                <p className="text-gray-600">General product images shown by default. To add images per variant, use the Variants tab.</p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {images.map((img: any, index: number) => (
                                    <div key={index} className="relative group">
                                        <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200">
                                            <img src={img.url} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                                        </div>
                                        {index === 0 && (
                                            <span className="absolute top-2 left-2 bg-blue-700 text-white px-2 py-1 rounded text-xs font-semibold">Primary</span>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2 rounded-xl">
                                            <a href={img.url} target="_blank" rel="noreferrer" className="w-9 h-9 flex items-center justify-center bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                                                <i className="ri-eye-line"></i>
                                            </a>
                                            <button
                                                onClick={() => handleRemoveImage(index)}
                                                className="w-9 h-9 flex items-center justify-center bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                            >
                                                <i className="ri-delete-bin-line"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <label className={`aspect-square border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-700 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center space-y-2 text-gray-600 hover:text-blue-700 cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {uploading ? <i className="ri-loader-4-line animate-spin text-3xl"></i> : <i className="ri-upload-2-line text-3xl"></i>}
                                    <span className="text-sm font-semibold text-center px-2">{uploading ? 'Uploading...' : 'Upload Images'}</span>
                                    <span className="text-xs text-gray-400">Tap to select multiple</span>
                                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
                                </label>
                            </div>

                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                <p className="text-sm text-gray-700">
                                    <strong>Image Guidelines:</strong> Use high-quality images (min 1000x1000px), white or neutral backgrounds work best. Supported formats: JPG, PNG, WebP (max 5MB each).
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── SEO TAB ── */}
                    {activeTab === 'seo' && (
                        <div className="space-y-6 max-w-3xl">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">Search Engine Optimization</h3>
                                <p className="text-gray-600">Optimize how this product appears in search results</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">Page Title</label>
                                <input
                                    type="text"
                                    value={seoTitle}
                                    onChange={(e) => setSeoTitle(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="SEO friendly title"
                                />
                                <p className="text-sm text-gray-500 mt-2">60 characters recommended</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">Meta Description</label>
                                <textarea
                                    rows={3}
                                    maxLength={500}
                                    value={metaDescription}
                                    onChange={(e) => setMetaDescription(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    placeholder="SEO friendly description"
                                />
                                <p className="text-sm text-gray-500 mt-2">160 characters recommended</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">URL Slug</label>
                                <div className="flex items-center">
                                    <span className="text-gray-600 bg-gray-100 px-4 py-3 border-2 border-r-0 border-gray-300 rounded-l-lg">store.com/product/</span>
                                    <input
                                        type="text"
                                        value={urlSlug}
                                        onChange={(e) => setUrlSlug(e.target.value)}
                                        className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="product-slug"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-2">Keywords</label>
                                <input
                                    type="text"
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="keyword1, keyword2"
                                />
                                <p className="text-sm text-gray-500 mt-2">Separate keywords with commas</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
