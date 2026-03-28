'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cachedQuery } from '@/lib/query-cache';
import ProductCard from '@/components/ProductCard';
import ProductReviews from '@/components/ProductReviews';
import LazyImage from '@/components/LazyImage';
import { getOptimizedImageUrl } from '@/lib/imageOptimization';
import { StructuredData, generateProductSchema, generateBreadcrumbSchema } from '@/components/SEOHead';
import { notFound } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { usePageTitle } from '@/hooks/usePageTitle';

// Map common color names to hex values for the swatch preview
function colorNameToHex(name: string): string {
  const map: Record<string, string> = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
    orange: '#f97316', purple: '#a855f7', pink: '#ec4899', black: '#111827',
    white: '#ffffff', gray: '#6b7280', grey: '#6b7280', brown: '#92400e',
    navy: '#1e3a5f', gold: '#d4a017', silver: '#c0c0c0', beige: '#f5f5dc',
    maroon: '#800000', teal: '#14b8a6', coral: '#ff7f50', ivory: '#fffff0',
    cream: '#fffdd0', burgundy: '#800020', lavender: '#e6e6fa', cyan: '#06b6d4',
    magenta: '#d946ef', olive: '#84cc16', peach: '#ffcba4', mint: '#98f5e1',
    rose: '#f43f5e', wine: '#722f37', charcoal: '#374151', sky: '#0ea5e9',
  };
  return map[name.toLowerCase().trim()] || '#d1d5db';
}

export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<any>(null);
  usePageTitle(product?.name || 'Product');
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [displayImages, setDisplayImages] = useState<string[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);

  const { addToCart } = useCart();

  // Swap gallery images when a variant is selected
  useEffect(() => {
    if (!product) return;
    if (selectedVariant) {
      const variantImageUrls = product.variantImagesMap?.[selectedVariant.id] || [];
      if (variantImageUrls.length > 0) {
        setDisplayImages(variantImageUrls);
        setSelectedImage(0);
        return;
      }
    }
    // Fall back to product-level images
    setDisplayImages(product.images.length > 0 ? product.images : []);
    setSelectedImage(0);
  }, [selectedVariant, product]);

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        // Fetch main product (cached for 2 minutes)
        const { data: productData, error } = await cachedQuery<{ data: any; error: any }>(
          `product:${slug}`,
          async () => {
            let query = supabase
              .from('products')
              .select(`
                *,
                categories(name),
                product_variants(*),
                product_images(url, position, alt_text, variant_id)
              `);

            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

            if (isUUID) {
              query = query.or(`id.eq.${slug},slug.eq.${slug}`);
            } else {
              query = query.eq('slug', slug);
            }

            return query.single() as any;
          },
          2 * 60 * 1000 // 2 minutes
        );

        if (error || !productData) {
          console.error('Error fetching product:', error);
          setLoading(false);
          return;
        }

        // Transform product data
        const rawVariants = (productData.product_variants || []).map((v: any) => ({
          ...v,
          color: v.option2 || '',
          colorHex: v.metadata?.color_hex || ''
        }));

        // Build a color-to-hex map
        const colorHexMap: Record<string, string> = {};
        rawVariants.forEach((v: any) => {
          if (v.color && !colorHexMap[v.color]) {
            colorHexMap[v.color] = v.colorHex || colorNameToHex(v.color);
          }
        });

        // Separate product-level images from variant-specific images
        const allImages = (productData.product_images || []).sort((a: any, b: any) => a.position - b.position);
        const productLevelImages = allImages.filter((img: any) => !img.variant_id).map((img: any) => img.url);
        const variantImagesMap: Record<string, string[]> = {};
        allImages.filter((img: any) => img.variant_id).forEach((img: any) => {
          if (!variantImagesMap[img.variant_id]) variantImagesMap[img.variant_id] = [];
          variantImagesMap[img.variant_id].push(img.url);
        });
        // Fallback: use image_url from variant row if no product_images entry
        rawVariants.forEach((v: any) => {
          if (!variantImagesMap[v.id] && v.image_url) {
            variantImagesMap[v.id] = [v.image_url];
          }
        });

        // Each variant is its own selectable option — label is name OR colorName, whichever is set
        // "colors" here means the unique option1 values that drive image swapping
        const variantLabels = rawVariants.map((v: any) => v.name || v.color || '').filter(Boolean);

        const transformedProduct = {
          ...productData,
          images: productLevelImages.length > 0 ? productLevelImages : [],
          variantImagesMap,
          category: productData.categories?.name || 'Shop',
          rating: productData.rating_avg || 0,
          reviewCount: 0,
          stockCount: productData.quantity,
          moq: productData.moq || 1,
          // colors = unique option2 values (for color swatch display)
          colors: [...new Set(rawVariants.map((v: any) => v.color).filter(Boolean))],
          colorHexMap,
          variants: rawVariants,
          variantLabels,
          sizes: rawVariants.map((v: any) => v.name) || [],
          features: ['Premium Quality', 'Authentic Design'],
          featured: ['Premium Quality', 'Authentic Design'],
          care: 'Handle with care.',
          preorderShipping: productData.metadata?.preorder_shipping || null
        };

        // No placeholder — LazyImage handles empty/missing src gracefully

        setProduct(transformedProduct);
        setDisplayImages(transformedProduct.images);
        setSelectedImage(0);

        // Set initial quantity to MOQ
        if (transformedProduct.moq > 1) {
          setQuantity(transformedProduct.moq);
        }

        // If variants exist, do NOT pre-select — force user to choose
        // Reset variant and color selection
        setSelectedVariant(null);
        setSelectedSize('');
        setSelectedColor('');

        // Fetch related products (cached for 5 minutes)
        if (productData.category_id) {
          const { data: related } = await cachedQuery<{ data: any; error: any }>(
            `related:${productData.category_id}:${productData.id}`,
            (() => supabase
              .from('products')
              .select('*, product_images(url, position), product_variants(id, name, price, quantity)')
              .eq('category_id', productData.category_id)
              .neq('id', productData.id)
              .limit(4)) as any,
            5 * 60 * 1000
          );

          if (related) {
            setRelatedProducts(related.map((p: any) => {
              const variants = p.product_variants || [];
              const hasVariants = variants.length > 0;
              const minVariantPrice = hasVariants ? Math.min(...variants.map((v: any) => v.price || p.price)) : undefined;
              const totalVariantStock = hasVariants ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) : 0;
              const effectiveStock = hasVariants ? totalVariantStock : p.quantity;
              return {
                id: p.id,
                slug: p.slug,
                name: p.name,
                price: p.price,
                image: p.product_images?.[0]?.url || '',
                rating: p.rating_avg || 0,
                reviewCount: 0,
                inStock: effectiveStock > 0,
                maxStock: effectiveStock || 50,
                moq: p.moq || 1,
                hasVariants,
                minVariantPrice
              };
            }));
          }
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  const hasVariants = product?.variants?.length > 0;
  const needsVariantSelection = hasVariants && !selectedVariant;

  // Determine the active price: variant price if selected, otherwise base price
  const activePrice = selectedVariant?.price ?? product?.price ?? 0;
  const activeStock = selectedVariant ? (selectedVariant.stock ?? selectedVariant.quantity ?? product?.stockCount ?? 0) : (product?.stockCount ?? 0);

  const handleAddToCart = () => {
    if (!product) return;
    if (needsVariantSelection) return; // Safety check

    // Build variant display string: "Color / Name" or just "Name" or just "Color"
    let variantLabel: string | undefined;
    if (selectedVariant) {
      const color = selectedVariant.color || selectedColor || '';
      const name = selectedVariant.name || '';
      if (color && name) {
        variantLabel = `${color} / ${name}`;
      } else {
        variantLabel = color || name || undefined;
      }
    }

    addToCart({
      id: product.id,
      name: product.name,
      price: activePrice,
      image: displayImages[0] || product.images[0],
      quantity: quantity,
      variant: variantLabel,
      slug: product.slug,
      maxStock: activeStock,
      moq: product.moq || 1
    });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    window.location.href = '/checkout';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white py-12 flex justify-center items-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-blue-700 animate-spin mb-4 block"></i>
          <p className="text-gray-500">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white py-20 flex justify-center items-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h2>
          <Link href="/shop" className="text-blue-700 hover:underline">Return to Shop</Link>
        </div>
      </div>
    );
  }

  const discount = product.compare_at_price ? Math.round((1 - activePrice / product.compare_at_price) * 100) : 0;
  const minVariantPrice = hasVariants ? Math.min(...product.variants.map((v: any) => v.price || product.price)) : product.price;

  const productSchema = generateProductSchema({
    name: product.name,
    description: product.description,
    image: product.images[0],
    price: hasVariants ? minVariantPrice : product.price,
    currency: 'GHS',
    sku: product.sku,
    rating: product.rating,
    reviewCount: product.reviewCount,
    availability: product.quantity > 0 ? 'in_stock' : 'out_of_stock',
    category: product.category
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: 'https://standardecom.com' },
    { name: 'Shop', url: 'https://standardecom.com/shop' },
    { name: product.category, url: `https://standardecom.com/shop?category=${product.category.toLowerCase().replace(/\s+/g, '-')}` },
    { name: product.name, url: `https://standardecom.com/product/${slug}` }
  ]);

  return (
    <>
      <StructuredData data={productSchema} />
      <StructuredData data={breadcrumbSchema} />

      <main className="min-h-screen bg-white">
        <section className="py-8 bg-gray-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav className="flex items-center space-x-2 text-sm flex-wrap gap-y-2">
              <Link href="/" className="text-gray-600 hover:text-blue-700 transition-colors">Home</Link>
              <i className="ri-arrow-right-s-line text-gray-400"></i>
              <Link href="/shop" className="text-gray-600 hover:text-blue-700 transition-colors">Shop</Link>
              <i className="ri-arrow-right-s-line text-gray-400"></i>
              <Link href="#" className="text-gray-600 hover:text-blue-700 transition-colors">{product.category}</Link>
              <i className="ri-arrow-right-s-line text-gray-400"></i>
              <span className="text-gray-900 font-medium truncate max-w-[200px]">{product.name}</span>
            </nav>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4 shadow-lg border border-gray-100">
                  <LazyImage
                    src={displayImages[selectedImage] || displayImages[0] || ''}
                    alt={product.name}
                    className="object-cover object-center transition-opacity duration-300"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                  />
                  {discount > 0 && (
                    <span className="absolute top-6 right-6 bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-full">
                      Save {discount}%
                    </span>
                  )}
                </div>

                {displayImages.length > 1 && (
                  <div className="grid grid-cols-4 gap-4">
                    {displayImages.map((image: string, index: number) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${selectedImage === index ? 'border-blue-700 shadow-md' : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <LazyImage
                          src={image}
                          alt={`${product.name} view ${index + 1}`}
                          className="object-cover object-center"
                          sizes="(max-width: 1024px) 25vw, 12vw"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-blue-700 font-semibold mb-2">{product.category}</p>
                    <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">{product.name}</h1>
                  </div>
                  <button
                    onClick={() => setIsWishlisted(!isWishlisted)}
                    className="w-12 h-12 flex items-center justify-center border-2 border-gray-200 hover:border-blue-700 rounded-full transition-colors cursor-pointer"
                  >
                    <i className={`${isWishlisted ? 'ri-heart-fill text-red-600' : 'ri-heart-line text-gray-700'} text-xl`}></i>
                  </button>
                </div>

                <div className="flex items-center mb-6">
                  <div className="flex items-center space-x-1 mr-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <i
                        key={star}
                        className={`${star <= Math.round(product.rating) ? 'ri-star-fill text-amber-400' : 'ri-star-line text-gray-300'} text-lg`}
                      ></i>
                    ))}
                  </div>
                  <span className="text-gray-700 font-medium">{Number(product.rating).toFixed(1)}</span>
                </div>

                <div className="flex items-baseline space-x-4 mb-6">
                  {hasVariants && !selectedVariant ? (
                    <span className="text-3xl lg:text-4xl font-bold text-gray-900">
                      From GH₵{minVariantPrice.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-3xl lg:text-4xl font-bold text-gray-900">GH₵{activePrice.toFixed(2)}</span>
                  )}
                  {product.compare_at_price && product.compare_at_price > activePrice && (
                    <span className="text-xl text-gray-400 line-through">GH₵{product.compare_at_price.toFixed(2)}</span>
                  )}
                </div>

                <p className="text-gray-700 leading-relaxed mb-8 text-lg">{product.description}</p>

                {/* Variant Selector — one button per variant row */}
                {hasVariants && (
                  <div className="mb-6">
                    <label className="block font-semibold text-gray-900 mb-3">
                      {selectedVariant ? (
                        <span>
                          Variant: <span className="text-blue-700 font-normal">{selectedVariant.name || selectedVariant.color} — GH₵{(selectedVariant.price || product.price).toFixed(2)}</span>
                        </span>
                      ) : (
                        <span>Variant: <span className="text-red-500 font-normal text-sm">Please select</span></span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {product.variants.map((variant: any) => {
                        const isSelected = selectedVariant?.id === variant.id;
                        const variantStock = variant.stock ?? variant.quantity ?? 0;
                        const isOutOfStock = variantStock === 0 && product.stockCount === 0;
                        const variantThumb = product.variantImagesMap?.[variant.id]?.[0];
                        const label = variant.name || variant.color || 'Option';
                        const colorHex = variant.colorHex || (variant.color ? colorNameToHex(variant.color) : null);

                        const handleSelect = () => {
                          setSelectedVariant(variant);
                          setSelectedColor(variant.color || label);
                          setSelectedSize(variant.name || '');
                        };

                        // Image thumbnail style
                        if (variantThumb) {
                          return (
                            <button
                              key={variant.id}
                              onClick={handleSelect}
                              disabled={isOutOfStock}
                              title={label}
                              className={`relative flex flex-col items-center gap-1.5 cursor-pointer transition-all ${isOutOfStock ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                              <div className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-blue-700 ring-2 ring-blue-400 ring-offset-1' : 'border-gray-200 hover:border-gray-400'}`}>
                                <img src={getOptimizedImageUrl(variantThumb, { width: 160 })} alt={label} className="w-full h-full object-cover" loading="lazy" />
                              </div>
                              <span className={`text-xs font-medium max-w-[64px] truncate text-center ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>{label}</span>
                              {isSelected && <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-700 rounded-full flex items-center justify-center"><i className="ri-check-line text-white text-[9px]"></i></span>}
                            </button>
                          );
                        }

                        // Color swatch + text pill
                        return (
                          <button
                            key={variant.id}
                            onClick={handleSelect}
                            disabled={isOutOfStock}
                            className={`px-4 py-2.5 rounded-full border-2 font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${isSelected
                              ? 'border-blue-700 bg-blue-50 text-blue-700 shadow-sm'
                              : isOutOfStock
                                ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                                : 'border-gray-300 text-gray-700 hover:border-gray-400'
                              }`}
                          >
                            {colorHex && colorHex !== '#d1d5db' && (
                              <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: colorHex }}></span>
                            )}
                            <span>{label}</span>
                            <span className={`text-xs ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>GH₵{(variant.price || product.price).toFixed(2)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mb-8">
                  <label className="block font-semibold text-gray-900 mb-3">Quantity</label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center border-2 border-gray-300 rounded-lg">
                      <button
                        onClick={() => setQuantity(Math.max(product.moq || 1, quantity - 1))}
                        className="w-12 h-12 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                        disabled={activeStock === 0 || quantity <= (product.moq || 1)}
                      >
                        <i className="ri-subtract-line text-xl"></i>
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(product.moq || 1, Math.min(activeStock, parseInt(e.target.value) || (product.moq || 1))))}
                        className="w-16 h-12 text-center border-x-2 border-gray-300 focus:outline-none text-lg font-semibold"
                        min={product.moq || 1}
                        max={activeStock}
                        disabled={activeStock === 0}
                      />
                      <button
                        onClick={() => setQuantity(Math.min(activeStock, quantity + 1))}
                        className="w-12 h-12 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                        disabled={activeStock === 0}
                      >
                        <i className="ri-add-line text-xl"></i>
                      </button>
                    </div>
                    <div className="flex flex-col">
                      {product.moq > 1 && (
                        <span className="text-blue-700 font-medium text-sm">
                          <i className="ri-information-line mr-1"></i>
                          Min. order: {product.moq} units
                        </span>
                      )}
                      {activeStock > 0 && (
                        <span className="text-gray-600 font-medium text-sm">
                          <i className="ri-checkbox-circle-line mr-1 text-blue-600"></i>
                          In stock
                        </span>
                      )}
                      {activeStock === 0 && (
                        <span className="text-red-600 font-medium">
                          <i className="ri-close-circle-line mr-1"></i>
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <button
                    disabled={activeStock === 0 || needsVariantSelection}
                    className={`flex-1 bg-gray-900 hover:bg-blue-700 text-white py-4 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 text-lg whitespace-nowrap cursor-pointer ${(activeStock === 0 || needsVariantSelection) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleAddToCart}
                  >
                    <i className="ri-shopping-cart-line text-xl"></i>
                    <span>{activeStock === 0 ? 'Out of Stock' : needsVariantSelection ? 'Select a Variant' : 'Add to Cart'}</span>
                  </button>
                  {activeStock > 0 && !needsVariantSelection && (
                    <button
                      onClick={handleBuyNow}
                      className="sm:w-auto bg-blue-700 hover:bg-blue-800 text-white px-8 py-4 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Buy Now
                    </button>
                  )}
                </div>

                {/* Delivery notice */}
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                  <i className="ri-truck-line text-xl text-blue-700 flex-shrink-0 mt-0.5"></i>
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Expected Delivery</p>
                    <p>Orders are delivered within <strong>24 – 72 hours</strong> after payment is confirmed. For faster or urgent deliveries, <strong>contact our customer care team</strong>.</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <div className="flex items-center text-gray-700">
                    <i className="ri-store-2-line text-xl text-blue-700 mr-3"></i>
                    <span>Free store pickup available</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <i className="ri-arrow-left-right-line text-xl text-blue-700 mr-3"></i>
                    <span>Easy returns and exchanges</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <i className="ri-shield-check-line text-xl text-blue-700 mr-3"></i>
                    <span>Secure payment & buyer protection</span>
                  </div>
                  {product.sku && (
                    <div className="flex items-center text-gray-700">
                      <i className="ri-barcode-line text-xl text-blue-700 mr-3"></i>
                      <span>Product Code: <span className="font-mono font-semibold">{product.sku}</span></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="border-b border-gray-300 mb-8">
              <div className="flex space-x-4 sm:space-x-8 overflow-x-auto">
                {['description', 'features', 'care', 'reviews'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 font-semibold transition-colors relative whitespace-nowrap cursor-pointer ${activeTab === tab
                      ? 'text-blue-700 border-b-2 border-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'description' && (
              <div className="prose max-w-none">
                <p className="text-gray-700 text-lg leading-relaxed">{product.description}</p>
              </div>
            )}

            {activeTab === 'features' && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Key Features</h3>
                <ul className="grid md:grid-cols-2 gap-4">
                  {product.features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <i className="ri-checkbox-circle-fill text-blue-700 text-xl mr-3 mt-1"></i>
                      <span className="text-gray-700 text-lg">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'care' && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Care Instructions</h3>
                <p className="text-gray-700 text-lg leading-relaxed">{product.care}</p>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div id="reviews">
                <ProductReviews productId={product.id} />
              </div>
            )}
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="py-20 bg-white" data-product-shop>
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">You May Also Like</h2>
                <p className="text-lg text-gray-600">Curated recommendations based on this product</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} {...p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
