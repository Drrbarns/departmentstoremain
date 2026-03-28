'use client';

import Link from 'next/link';
import { getOptimizedImageUrl } from '@/lib/imageOptimization';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
}

export default function CartSuggestions() {
  const suggestedProducts: Product[] = [
    {
      id: '21',
      name: 'Premium Wireless Headphones',
      price: 129.99,
      originalPrice: 179.99,
      image: 'https://readdy.ai/api/search-image?query=Premium%20wireless%20over-ear%20headphones%20with%20black%20matte%20finish%20and%20cushioned%20ear%20cups%20displayed%20on%20a%20clean%20white%20studio%20background%20with%20soft%20lighting%20emphasizing%20the%20sleek%20modern%20design%20and%20premium%20quality%20materials%20perfect%20for%20ecommerce%20product%20photography&width=400&height=400&seq=cart-sugg-1&orientation=squarish',
      rating: 4.8
    },
    {
      id: '22',
      name: 'Leather Card Holder Wallet',
      price: 34.99,
      originalPrice: 49.99,
      image: 'https://readdy.ai/api/search-image?query=Elegant%20minimalist%20brown%20leather%20card%20holder%20wallet%20with%20multiple%20card%20slots%20displayed%20open%20on%20a%20clean%20white%20marble%20surface%20with%20soft%20natural%20lighting%20showcasing%20premium%20leather%20texture%20and%20craftsmanship%20perfect%20for%20ecommerce%20product%20photography&width=400&height=400&seq=cart-sugg-2&orientation=squarish',
      rating: 4.7
    },
    {
      id: '23',
      name: 'Smart Watch Band',
      price: 24.99,
      image: 'https://readdy.ai/api/search-image?query=Modern%20silicone%20smart%20watch%20band%20in%20sleek%20black%20color%20with%20metal%20clasp%20displayed%20on%20a%20clean%20white%20surface%20with%20soft%20studio%20lighting%20highlighting%20the%20texture%20and%20flexibility%20of%20the%20band%20perfect%20for%20ecommerce%20product%20photography&width=400&height=400&seq=cart-sugg-3&orientation=squarish',
      rating: 4.6
    },
    {
      id: '24',
      name: 'Phone Stand Holder',
      price: 19.99,
      originalPrice: 29.99,
      image: 'https://readdy.ai/api/search-image?query=Modern%20minimalist%20aluminum%20phone%20stand%20holder%20in%20silver%20finish%20with%20adjustable%20angle%20displayed%20on%20a%20clean%20white%20desk%20surface%20with%20soft%20studio%20lighting%20emphasizing%20the%20sleek%20design%20and%20premium%20quality%20perfect%20for%20ecommerce%20product%20photography&width=400&height=400&seq=cart-sugg-4&orientation=squarish',
      rating: 4.5
    }
  ];

  return (
    <div className="bg-blue-50 border-2 border-blue-100 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">You Might Also Like</h3>
        <span className="text-sm text-blue-700 font-medium whitespace-nowrap">Boost Your Order</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {suggestedProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <Link href={`/product/${product.id}`}>
              <div className="aspect-square bg-gray-100 overflow-hidden">
                <img
                  src={getOptimizedImageUrl(product.image, { width: 480 })}
                  alt={product.name}
                  className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">{product.name}</h4>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-lg font-bold text-blue-700">GH₵{product.price.toFixed(2)}</span>
                  {product.originalPrice && (
                    <span className="text-xs text-gray-400 line-through">GH₵{product.originalPrice.toFixed(2)}</span>
                  )}
                </div>
                <button className="w-full py-2 bg-blue-700 text-white text-sm rounded-lg font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap">
                  <i className="ri-add-line mr-1"></i>
                  Quick Add
                </button>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
