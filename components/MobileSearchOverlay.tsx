'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getOptimizedImageUrl } from '@/lib/imageOptimization';

interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSearchOverlay({ isOpen, onClose }: MobileSearchOverlayProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([
    'Summer Dress',
    'Running Shoes',
    'Leather Bag',
    'Sunglasses'
  ]);

  const popularSearches = [
    'New Arrivals',
    'Sale Items',
    'Dresses',
    'Men\'s Shoes',
    'Electronics',
    'Bags & Purses'
  ];

  const searchSuggestions = [
    { name: 'Summer Floral Dress', category: 'Women\'s Clothing', price: 'GH₵289', image: 'https://readdy.ai/api/search-image?query=elegant%20summer%20floral%20dress%20on%20white%20mannequin%20with%20simple%20clean%20white%20studio%20background%20soft%20natural%20lighting%20feminine%20style%20fashion%20photography%20high%20quality%20detailed&width=80&height=80&seq=mob1&orientation=squarish' },
    { name: 'Classic Leather Handbag', category: 'Bags', price: 'GH₵459', image: 'https://readdy.ai/api/search-image?query=luxury%20brown%20leather%20handbag%20on%20white%20surface%20clean%20minimalist%20white%20studio%20background%20professional%20product%20photography%20high%20quality%20detailed%20premium%20fashion&width=80&height=80&seq=mob2&orientation=squarish' },
    { name: 'Designer Sunglasses', category: 'Accessories', price: 'GH₵199', image: 'https://readdy.ai/api/search-image?query=stylish%20modern%20sunglasses%20on%20white%20display%20stand%20clean%20white%20studio%20background%20professional%20product%20photography%20high%20quality%20detailed%20fashion%20accessory&width=80&height=80&seq=mob3&orientation=squarish' }
  ];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 lg:hidden overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <i className="ri-arrow-left-line text-xl"></i>
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-10 py-3 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
              <i className="ri-search-line text-gray-400 text-lg"></i>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {!searchQuery && (
          <>
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Recent Searches</h3>
                  <button 
                    onClick={() => setRecentSearches([])}
                    className="text-xs text-blue-700 font-medium whitespace-nowrap"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2">
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className="ri-time-line text-gray-400"></i>
                        </div>
                        <span className="text-sm text-gray-700">{search}</span>
                      </div>
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className="ri-arrow-right-up-line text-gray-400"></i>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Popular Searches</h3>
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((search, index) => (
                  <button
                    key={index}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-blue-50 hover:text-blue-700 transition-colors whitespace-nowrap"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {searchQuery && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Suggestions</h3>
            <div className="space-y-3">
              {searchSuggestions.map((product, index) => (
                <Link
                  key={index}
                  href={`/product/${index + 1}`}
                  className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                  onClick={onClose}
                >
                  <img
                    src={getOptimizedImageUrl(product.image, { width: 160 })}
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded-lg"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">{product.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{product.category}</p>
                    <p className="text-sm font-semibold text-blue-700 mt-1">{product.price}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
