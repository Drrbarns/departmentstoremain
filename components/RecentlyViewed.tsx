'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getOptimizedImageUrl } from '@/lib/imageOptimization';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating: number;
}

export default function RecentlyViewed() {
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('recentlyViewed');
    if (stored) {
      setRecentProducts(JSON.parse(stored));
    }
  }, []);

  if (recentProducts.length === 0) return null;

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Recently Viewed</h2>
          <button
            onClick={() => {
              localStorage.removeItem('recentlyViewed');
              setRecentProducts([]);
            }}
            className="text-sm text-blue-700 hover:text-blue-800 font-medium whitespace-nowrap"
          >
            Clear History
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {recentProducts.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.id}`}
              className="group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className="aspect-square bg-gray-100 overflow-hidden">
                <img
                  src={getOptimizedImageUrl(product.image, { width: 480 })}
                  alt={product.name}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <p className="text-xs text-gray-500 mb-1">{product.category}</p>
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 text-sm">
                  {product.name}
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold text-gray-900">
                    GH₵{product.price.toFixed(2)}
                  </span>
                  {product.originalPrice && (
                    <span className="text-sm text-gray-400 line-through">
                      GH₵{product.originalPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function addToRecentlyViewed(product: Product) {
  if (typeof window === 'undefined') return;

  const stored = localStorage.getItem('recentlyViewed');
  let recent: Product[] = stored ? JSON.parse(stored) : [];

  recent = recent.filter((p) => p.id !== product.id);
  recent.unshift(product);
  recent = recent.slice(0, 10);

  localStorage.setItem('recentlyViewed', JSON.stringify(recent));
}
