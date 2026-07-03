'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LazyImage from './LazyImage';
import { useCart } from '@/context/CartContext';
import { useAffiliate } from '@/context/AffiliateContext';
import { useWishlist } from '@/context/WishlistContext';

// Map common color names to hex values for swatches
const COLOR_MAP: Record<string, string> = {
  black: '#000000', white: '#FFFFFF', red: '#EF4444', blue: '#3B82F6',
  navy: '#1E3A5F', green: '#22C55E', yellow: '#EAB308', orange: '#F97316',
  pink: '#EC4899', purple: '#A855F7', brown: '#92400E', beige: '#D4C5A9',
  grey: '#6B7280', gray: '#6B7280', cream: '#FFFDD0', teal: '#14B8A6',
  maroon: '#800000', coral: '#FF7F50', burgundy: '#800020', olive: '#808000',
  tan: '#D2B48C', khaki: '#C3B091', charcoal: '#36454F', ivory: '#FFFFF0',
  gold: '#FFD700', silver: '#C0C0C0', rose: '#FF007F', lavender: '#E6E6FA',
  mint: '#98FB98', peach: '#FFDAB9', wine: '#722F37', denim: '#1560BD',
  nude: '#E3BC9A', camel: '#C19A6B', sage: '#BCB88A', rust: '#B7410E',
  mustard: '#FFDB58', plum: '#8E4585', lilac: '#C8A2C8', stone: '#928E85',
  sand: '#C2B280', taupe: '#483C32', mauve: '#E0B0FF', sky: '#87CEEB',
  forest: '#228B22', cobalt: '#0047AB', emerald: '#50C878', scarlet: '#FF2400',
  aqua: '#00FFFF', turquoise: '#40E0D0', indigo: '#4B0082', crimson: '#DC143C',
  magenta: '#FF00FF', cyan: '#00FFFF', chocolate: '#7B3F00', coffee: '#6F4E37',
};

export function getColorHex(colorName: string): string | null {
  const lower = colorName.toLowerCase().trim();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  // Try partial match (e.g. "Light Blue" -> "blue")
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

export interface ColorVariant {
  name: string;
  hex: string;
}

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  categoryName?: string;
  inStock?: boolean;
  maxStock?: number;
  moq?: number;
  hasVariants?: boolean;
  minVariantPrice?: number;
  colorVariants?: ColorVariant[];
}

export default function ProductCard({
  id,
  slug,
  name,
  price,
  originalPrice,
  image,
  rating = 5,
  reviewCount = 0,
  badge,
  categoryName,
  inStock = true,
  maxStock = 50,
  moq = 1,
  hasVariants = false,
  minVariantPrice,
  colorVariants = []
}: ProductCardProps) {
  const { addToCart } = useCart();
  const { mk } = useAffiliate();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [wished, setWished] = useState(false);

  const displayPrice = hasVariants && minVariantPrice ? minVariantPrice : price;
  const discount = originalPrice ? Math.round((1 - displayPrice / originalPrice) * 100) : 0;
  const onSale = discount > 0;
  const MAX_SWATCHES = 5;

  useEffect(() => {
    setWished(isInWishlist(id));
  }, [id, isInWishlist]);

  // Affiliate markup is display-only; the cart always stores the base price so
  // the order is re-priced authoritatively server-side at checkout.
  const formatPrice = (val: number) => `GH\u20B5${mk(val, id).toFixed(2)}`;

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInWishlist(id)) {
      removeFromWishlist(id);
      setWished(false);
    } else {
      addToWishlist({ id, name, price: displayPrice, originalPrice, image, rating, reviewCount, badge, inStock, slug });
      setWished(true);
    }
    // Keep the header badge (which reads localStorage) in sync in the same tab.
    window.dispatchEvent(new Event('wishlistUpdated'));
  };

  return (
    <div className="group relative h-full flex flex-col">
      <Link href={`/product/${slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#ecfdf5] shadow-sm transition-shadow duration-300 group-hover:shadow-xl">
          <LazyImage
            src={image}
            alt={name}
            className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
          />

          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
            {onSale && (
              <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white shadow-sm">
                -{discount}%
              </span>
            )}
            {badge && (
              <span className="rounded-full bg-[#0B1B3A] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white shadow-sm">
                {badge}
              </span>
            )}
          </div>

          {!inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
              <span className="rounded-lg bg-[#0B1B3A] px-4 py-2 text-sm font-medium text-white">Out of Stock</span>
            </div>
          )}
        </div>
      </Link>

      <button
        onClick={toggleWishlist}
        className={`absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-all hover:scale-110 ${
          wished ? 'text-emerald-700' : 'text-[#0B1B3A]'
        }`}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <i className={`${wished ? 'ri-heart-fill' : 'ri-heart-line'} text-base`}></i>
      </button>

      <div className="mt-3.5 flex flex-1 flex-col space-y-1.5 px-0.5">
        <Link href={`/product/${slug}`} className="block">
          {categoryName && (
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{categoryName}</p>
          )}
          <h3 className="mt-0.5 font-serif text-base font-semibold leading-tight text-[#0B1B3A] transition-colors line-clamp-2 group-hover:text-emerald-700">
            {name}
          </h3>
        </Link>

        {colorVariants.length > 0 && (
          <div className="flex items-center gap-1.5">
            {colorVariants.slice(0, MAX_SWATCHES).map((color) => (
              <button
                key={color.name}
                title={color.name}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveColor(activeColor === color.name ? null : color.name);
                }}
                className={`w-4 h-4 rounded-full border transition-all duration-200 flex-shrink-0 ${
                  activeColor === color.name
                    ? 'ring-2 ring-offset-1 ring-emerald-500 scale-110'
                    : 'hover:scale-110'
                } ${color.hex === '#FFFFFF' ? 'border-gray-300' : 'border-transparent'}`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
            {colorVariants.length > MAX_SWATCHES && (
              <span className="text-xs text-gray-400 ml-0.5">+{colorVariants.length - MAX_SWATCHES}</span>
            )}
          </div>
        )}

        <div className="flex items-baseline gap-2">
          {hasVariants && minVariantPrice ? (
            <span className="font-semibold text-[#0B1B3A]">From {formatPrice(minVariantPrice)}</span>
          ) : (
            <span className={`font-semibold ${onSale ? 'text-emerald-700' : 'text-[#0B1B3A]'}`}>{formatPrice(price)}</span>
          )}
          {originalPrice && (
            <span className="text-sm text-gray-400 line-through">{formatPrice(originalPrice)}</span>
          )}
        </div>

        <div className="mt-auto pt-2">
          {hasVariants ? (
            <Link
              href={`/product/${slug}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d1fae5] bg-white py-2.5 text-sm font-medium text-[#0B1B3A] transition-all hover:border-emerald-400 hover:bg-[#ecfdf5] hover:text-emerald-700"
            >
              <i className="ri-list-check text-sm"></i>
              <span>Select Options</span>
            </Link>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                addToCart({ id, name, price, image, quantity: moq, slug, maxStock, moq });
              }}
              disabled={!inStock}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d1fae5] bg-white py-2.5 text-sm font-medium text-[#0B1B3A] transition-all hover:border-emerald-400 hover:bg-[#ecfdf5] hover:text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-shopping-bag-line text-sm"></i>
              <span>{moq > 1 ? `Add ${moq} to Bag` : 'Add to Bag'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
