'use client';

import { useState } from 'react';

interface ProductSortProps {
  onSortChange: (sortBy: string) => void;
  totalProducts: number;
}

export default function ProductSort({ onSortChange, totalProducts }: ProductSortProps) {
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const sortOptions = [
    { value: 'popular', label: 'Most Popular' },
    { value: 'newest', label: 'Newest First' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'name-asc', label: 'Name: A to Z' },
    { value: 'name-desc', label: 'Name: Z to A' }
  ];

  const handleSortChange = (value: string) => {
    setSortBy(value);
    onSortChange(value);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <p className="text-gray-700">
            <span className="font-bold text-gray-900">{totalProducts}</span> Products Found
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-4 py-2 pr-8 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200 bg-white cursor-pointer"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center border-2 border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`w-10 h-10 flex items-center justify-center transition-colors ${
                viewMode === 'grid' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <i className="ri-grid-line"></i>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`w-10 h-10 flex items-center justify-center transition-colors ${
                viewMode === 'list' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <i className="ri-list-check"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
