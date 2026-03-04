'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cachedQuery } from '@/lib/query-cache';
import ProductCard from '@/components/ProductCard';
import ProductReviews from '@/components/ProductReviews';
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

  // Swap gallery images when a color/variant is selected
  useEffect(() => {
    if (!product) return;
    if (selectedColor) {
      const colorVariants = product.variants.filter((v: any) => v.color === selectedColor);
      const variantImageUrls = colorVariants.flatMap((v: any) => product.variantImagesMap?.[v.id] || []);
      if (variantImageUrls.length > 0) {
        setDisplayImages(variantImageUrls);
        setSelectedImage(0);
        return;
      }
    }
    // Fall back to product-level images
    setDisplayImages(product.images.length > 0 ? product.images : ['https://via.placeholder.com/800x800?text=No+Image']);
    setSelectedImage(0);
  }, [selectedColor, product]);

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
        // Map variant colors from option2, and extract color_hex from metadata
        const rawVariants = (productData.product_variants || []).map((v: any) => ({
          ...v,
          color: v.option2 || '',
          colorHex: v.metadata?.color_hex || ''
        }));

        // Build a color-to-hex map from variants (prefer stored hex, fallback to colorNameToHex)
        const colorHexMap: Record<string, string> = {};
        rawVariants.forEach((v: any) => {
          if (v.color) {
            if (!colorHexMap[v.color]) {
              colorHexMap[v.color] = v.colorHex || colorNameToHex(v.color);
            }
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

        const transformedProduct = {
          ...productData,
          images: productLevelImages.length > 0 ? productLevelImages : [],
          variantImagesMap,
          category: productData.categories?.name || 'Shop',
          rating: productData.rating_avg || 0,
          reviewCount: 0,
          stockCount: productData.quantity,
          moq: productData.moq || 1,
          colors: [...new Set(rawVariants.map((v: any) => v.color).filter(Boolean))],
          colorHexMap,
          variants: rawVariants,
          sizes: rawVariants.map((v: any) => v.name) || [],
          features: ['Premium Quality', 'Authentic Design'],
          featured: ['Premium Quality', 'Authentic Design'],
          care: 'Handle with care.',
          preorderShipping: productData.metadata?.preorder_shipping || null
        };

        // Ensure at least one image/placeholder
        if (transformedProduct.images.length === 0) {
          transformedProduct.images = ['https://via.placeholder.com/800x800?text=No+Image'];
        }

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
                image: p.product_images?.[0]?.url || 'https://via.placeholder.com/800?text=No+Image',
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
  const hasColors = product?.colors?.length > 0;
  const needsVariantSelection = hasVariants && !selectedVariant;
  const needsColorSelection = hasColors && !selectedColor;

  // Custom option names from product metadata
  const option1Name = product?.metadata?.option1_name || 'Color';
  const option2Name = product?.metadata?.option2_name || 'Size';

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
                  <Image
                    src={displayImages[selectedImage] || displayImages[0] || 'https://via.placeholder.com/800x800?text=No+Image'}
                    alt={product.name}
                    fill
                    className="object-cover object-center transition-opacity duration-300"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                    quality={80}
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
                        <Image
                          src={image}
                          alt={`${product.name} view ${index + 1}`}
                          fill
                          className="object-cover object-center"
                          sizes="(max-width: 1024px) 25vw, 12vw"
                          quality={60}
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

                {/* Option 1 Selector (Color / Design / Material / etc.) */}
                {hasVariants && product.colors.length > 0 && (
                  <div className="mb-6">
                    <label className="block font-semibold text-gray-900 mb-3">
                      {option1Name}:{' '}
                      {selectedColor ? (
                        <span className="text-blue-700 font-normal">{selectedColor}</span>
                      ) : (
                        <span className="text-red-500 font-normal text-sm">Please select</span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {product.colors.map((color: string) => {
                        const isSelected = selectedColor === color;
                        const colorVariants = product.variants.filter((v: any) => v.color === color);
                        const colorStock = colorVariants.reduce((sum: number, v: any) => sum + (v.stock ?? v.quantity ?? 0), 0);
                        const isOutOfStock = colorStock === 0 && product.stockCount === 0;

                        // Get the first image for this option1 value (for thumbnail display)
                        const variantId = colorVariants[0]?.id;
                        const variantThumb = variantId ? product.variantImagesMap?.[variantId]?.[0] : null;
                        const hasColorHex = !!(product.colorHexMap?.[color] || colorNameToHex(color) !== '#d1d5db');

                        const handleSelect = () => {
                          setSelectedColor(color);
                          const matching = product.variants.filter((v: any) => v.color === color);
                          if (matching.length === 1) {
                            setSelectedVariant(matching[0]);
                            setSelectedSize(matching[0].name);
                          } else {
                            setSelectedVariant(null);
                            setSelectedSize('');
                          }
                        };

                        // If there's a variant image thumbnail, show it as image swatch
                        if (variantThumb) {
                          return (
                            <button
                              key={color}
                              onClick={handleSelect}
                              disabled={isOutOfStock}
                              title={color}
                              className={`relative flex flex-col items-center gap-1.5 cursor-pointer group transition-all ${isOutOfStock ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                              <div className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-blue-700 ring-2 ring-blue-400 ring-offset-1' : 'border-gray-200 hover:border-gray-400'}`}>
                                <img src={variantThumb} alt={color} className="w-full h-full object-cover" />
                              </div>
                              <span className={`text-xs font-medium leading-tight text-center max-w-[64px] truncate ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>{color}</span>
                              {isSelected && <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-700 rounded-full flex items-center justify-center"><i className="ri-check-line text-white text-[9px]"></i></span>}
                            </button>
                          );
                        }

                        // Fall back to color swatch pill
                        return (
                          <button
                            key={color}
                            onClick={handleSelect}
                            disabled={isOutOfStock}
                            className={`px-5 py-2.5 rounded-full border-2 font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${isSelected
                              ? 'border-blue-700 bg-blue-50 text-blue-700 shadow-sm'
                              : isOutOfStock
                                ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                                : 'border-gray-300 text-gray-700 hover:border-gray-400'
                              }`}
                          >
                            {hasColorHex && (
                              <span className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0 shadow-sm" style={{ backgroundColor: product.colorHexMap?.[color] || colorNameToHex(color) }}></span>
                            )}
                            <span>{color}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Size / Name Variant Selector */}
                {hasVariants && (() => {
                  // Filter variants: if colors exist and one is selected, show only matching; otherwise show all
                  const hasColors = product.colors.length > 0;
                  const visibleVariants = hasColors && selectedColor
                    ? product.variants.filter((v: any) => v.color === selectedColor)
                    : hasColors
                      ? [] // Don't show name variants until a color is picked
                      : product.variants;

                  // Check if we need to show the name selector (skip if all visible variants have the same name or only 1)
                  const uniqueNames = [...new Set(visibleVariants.map((v: any) => v.name).filter(Boolean))];
                  const showNameSelector = visibleVariants.length > 1 || (!hasColors && visibleVariants.length > 0);

                  if (!showNameSelector && !hasColors) {
                    // Single variant with no colors — show standard picker
                    return (
                      <div className="mb-8">
                        <label className="block font-semibold text-gray-900 mb-3">
                          {option1Name || option2Name || 'Variant'}:{' '}
                          {selectedVariant ? (
                            <span className="text-blue-700 font-normal">{selectedVariant.name} — GH₵{selectedVariant.price?.toFixed(2)}</span>
                          ) : (
                            <span className="text-red-500 font-normal text-sm">Please select</span>
                          )}
                        </label>
                        <div className="flex flex-wrap gap-3">
                          {product.variants.map((variant: any) => {
                            const isSelected = selectedVariant?.id === variant.id || selectedVariant?.name === variant.name;
                            const variantStock = variant.stock ?? variant.quantity ?? 0;
                            const isOutOfStock = variantStock === 0 && product.stockCount === 0;
                            return (
                              <button
                                key={variant.id || variant.name}
                                onClick={() => {
                                  setSelectedVariant(variant);
                                  setSelectedSize(variant.name);
                                }}
                                disabled={isOutOfStock}
                                className={`px-6 py-3 rounded-lg border-2 font-medium transition-all whitespace-nowrap cursor-pointer flex flex-col items-center ${isSelected
                                  ? 'border-blue-700 bg-blue-50 text-blue-700 shadow-sm'
                                  : isOutOfStock
                                    ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                                  }`}
                              >
                                <span>{variant.name}</span>
                                <span className={`text-xs mt-0.5 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                                  GH₵{(variant.price || product.price).toFixed(2)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (visibleVariants.length > 1) {
                    return (
                      <div className="mb-8">
                        <label className="block font-semibold text-gray-900 mb-3">
                          {option2Name}:{' '}
                          {selectedVariant ? (
                            <span className="text-blue-700 font-normal">{selectedVariant.name} — GH₵{selectedVariant.price?.toFixed(2)}</span>
                          ) : (
                            <span className="text-red-500 font-normal text-sm">Please select</span>
                          )}
                        </label>
                        <div className="flex flex-wrap gap-3">
                          {visibleVariants.map((variant: any) => {
                            const isSelected = selectedVariant?.id === variant.id;
                            const variantStock = variant.stock ?? variant.quantity ?? 0;
                            const isOutOfStock = variantStock === 0 && product.stockCount === 0;
                            return (
                              <button
                                key={variant.id || variant.name}
                                onClick={() => {
                                  setSelectedVariant(variant);
                                  setSelectedSize(variant.name);
                                }}
                                disabled={isOutOfStock}
                                className={`px-6 py-3 rounded-lg border-2 font-medium transition-all whitespace-nowrap cursor-pointer flex flex-col items-center ${isSelected
                                  ? 'border-blue-700 bg-blue-50 text-blue-700 shadow-sm'
                                  : isOutOfStock
                                    ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                                  }`}
                              >
                                <span>{variant.name}</span>
                                <span className={`text-xs mt-0.5 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                                  GH₵{(variant.price || product.price).toFixed(2)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()}

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
                      {activeStock > 10 && (
                        <span className="text-gray-600 font-medium text-sm">
                          <i className="ri-checkbox-circle-line mr-1 text-blue-600"></i>
                          {activeStock} in stock
                        </span>
                      )}
                      {activeStock > 0 && activeStock <= 10 && (
                        <span className="text-amber-600 font-medium text-sm">
                          <i className="ri-error-warning-line mr-1"></i>
                          Only {activeStock} left in stock
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
                    disabled={activeStock === 0 || needsVariantSelection || needsColorSelection}
                    className={`flex-1 bg-gray-900 hover:bg-blue-700 text-white py-4 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 text-lg whitespace-nowrap cursor-pointer ${(activeStock === 0 || needsVariantSelection || needsColorSelection) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleAddToCart}
                  >
                    <i className="ri-shopping-cart-line text-xl"></i>
                    <span>{activeStock === 0 ? 'Out of Stock' : needsColorSelection ? 'Select a Color' : needsVariantSelection ? 'Select a Variant' : 'Add to Cart'}</span>
                  </button>
                  {activeStock > 0 && !needsVariantSelection && !needsColorSelection && (
                    <button
                      onClick={handleBuyNow}
                      className="sm:w-auto bg-blue-700 hover:bg-blue-800 text-white px-8 py-4 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Buy Now
                    </button>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <div className="flex items-center text-gray-700">
                    <i className="ri-store-2-line text-xl text-blue-700 mr-3"></i>
                    <span>Free store pickup available</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <i className="ri-arrow-left-right-line text-xl text-blue-700 mr-3"></i>
                    <span>30-day easy returns and exchanges</span>
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
