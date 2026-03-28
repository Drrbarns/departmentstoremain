'use client';

import { getOptimizedImageUrl } from '@/lib/imageOptimization';

interface UpsellProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  description: string;
  selected: boolean;
}

interface OrderBumpUpsellProps {
  products: UpsellProduct[];
  onToggle: (id: string) => void;
}

export default function OrderBumpUpsell({ products, onToggle }: OrderBumpUpsellProps) {
  if (products.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border-2 border-amber-200">
      <div className="flex items-center space-x-2 mb-4">
        <div className="w-10 h-10 flex items-center justify-center bg-amber-500 rounded-full">
          <i className="ri-gift-line text-white text-xl"></i>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Complete Your Order</h3>
          <p className="text-sm text-gray-600">Add these popular items before checkout</p>
        </div>
      </div>

      <div className="space-y-4">
        {products.map((product) => (
          <div
            key={product.id}
            className={`bg-white rounded-lg p-4 border-2 transition-all cursor-pointer ${
              product.selected
                ? 'border-blue-700 shadow-md'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onToggle(product.id)}
          >
            <div className="flex items-center space-x-4">
              <input
                type="checkbox"
                checked={product.selected}
                onChange={() => onToggle(product.id)}
                className="w-5 h-5 text-blue-700 rounded border-gray-300 focus:ring-blue-500"
              />
              
              <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                <img 
                  src={getOptimizedImageUrl(product.image, { width: 160 })}
                  alt={product.name}
                  className="w-full h-full object-cover object-top"
                  loading="lazy"
                />
              </div>

              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">{product.name}</h4>
                <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold text-blue-700">GH₵{product.price.toFixed(2)}</span>
                  {product.originalPrice && (
                    <>
                      <span className="text-sm text-gray-400 line-through">GH₵{product.originalPrice.toFixed(2)}</span>
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold whitespace-nowrap">
                        Save {Math.round((1 - product.price / product.originalPrice) * 100)}%
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className={`w-8 h-8 flex items-center justify-center rounded-full border-2 transition-colors ${
                product.selected
                  ? 'border-blue-700 bg-blue-700'
                  : 'border-gray-300'
              }`}>
                {product.selected && <i className="ri-check-line text-white"></i>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-amber-100 rounded-lg">
        <p className="text-sm text-amber-800 font-medium text-center">
          <i className="ri-flashlight-fill mr-1"></i>
          Limited time offer - Add to your order now!
        </p>
      </div>
    </div>
  );
}
