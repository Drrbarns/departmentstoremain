'use client';

import { useState } from 'react';

interface FilterOptions {
  priceRange: [number, number];
  categories: string[];
  brands: string[];
  ratings: number[];
  inStock: boolean;
  onSale: boolean;
}

interface ProductFiltersProps {
  onFilterChange: (filters: FilterOptions) => void;
}

export default function ProductFilters({ onFilterChange }: ProductFiltersProps) {
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<number[]>([]);
  const [inStock, setInStock] = useState(false);
  const [onSale, setOnSale] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const categories = ['Electronics', 'Fashion', 'Home Decor', 'Wearables', 'Clothing', 'Office'];
  const brands = ['Apple', 'Samsung', 'Nike', 'Adidas', 'Sony', 'LG'];
  const ratings = [5, 4, 3, 2, 1];

  const handleCategoryToggle = (category: string) => {
    const updated = selectedCategories.includes(category)
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    setSelectedCategories(updated);
    applyFilters({ categories: updated });
  };

  const handleBrandToggle = (brand: string) => {
    const updated = selectedBrands.includes(brand)
      ? selectedBrands.filter(b => b !== brand)
      : [...selectedBrands, brand];
    setSelectedBrands(updated);
    applyFilters({ brands: updated });
  };

  const handleRatingToggle = (rating: number) => {
    const updated = selectedRatings.includes(rating)
      ? selectedRatings.filter(r => r !== rating)
      : [...selectedRatings, rating];
    setSelectedRatings(updated);
    applyFilters({ ratings: updated });
  };

  const handlePriceChange = (index: 0 | 1, value: number) => {
    const updated: [number, number] = [...priceRange];
    updated[index] = value;
    setPriceRange(updated);
    applyFilters({ priceRange: updated });
  };

  const applyFilters = (updates: Partial<FilterOptions>) => {
    onFilterChange({
      priceRange,
      categories: selectedCategories,
      brands: selectedBrands,
      ratings: selectedRatings,
      inStock,
      onSale,
      ...updates
    });
  };

  const clearAllFilters = () => {
    setPriceRange([0, 1000]);
    setSelectedCategories([]);
    setSelectedBrands([]);
    setSelectedRatings([]);
    setInStock(false);
    setOnSale(false);
    onFilterChange({
      priceRange: [0, 1000],
      categories: [],
      brands: [],
      ratings: [],
      inStock: false,
      onSale: false
    });
  };

  const activeFilterCount = 
    selectedCategories.length + 
    selectedBrands.length + 
    selectedRatings.length + 
    (inStock ? 1 : 0) + 
    (onSale ? 1 : 0) +
    (priceRange[0] !== 0 || priceRange[1] !== 1000 ? 1 : 0);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-bold text-gray-900">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="bg-emerald-700 text-white text-xs font-bold px-2 py-1 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-emerald-700 hover:text-emerald-900 font-medium whitespace-nowrap"
            >
              Clear All
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-600"
          >
            <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line`}></i>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Price Range</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  value={priceRange[0]}
                  onChange={(e) => handlePriceChange(0, Number(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200"
                  placeholder="Min"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  value={priceRange[1]}
                  onChange={(e) => handlePriceChange(1, Number(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200"
                  placeholder="Max"
                />
              </div>
              <input
                type="range"
                min="0"
                max="1000"
                value={priceRange[1]}
                onChange={(e) => handlePriceChange(1, Number(e.target.value))}
                className="w-full accent-emerald-700"
              />
              <p className="text-sm text-gray-600">
                GH₵{priceRange[0]} - GH₵{priceRange[1]}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-900 mb-3">Category</h4>
            <div className="space-y-2">
              {categories.map((category) => (
                <label key={category} className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category)}
                    onChange={() => handleCategoryToggle(category)}
                    className="w-5 h-5 text-emerald-700 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-gray-700 group-hover:text-gray-900">{category}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-900 mb-3">Brand</h4>
            <div className="space-y-2">
              {brands.map((brand) => (
                <label key={brand} className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedBrands.includes(brand)}
                    onChange={() => handleBrandToggle(brand)}
                    className="w-5 h-5 text-emerald-700 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-gray-700 group-hover:text-gray-900">{brand}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-900 mb-3">Rating</h4>
            <div className="space-y-2">
              {ratings.map((rating) => (
                <label key={rating} className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedRatings.includes(rating)}
                    onChange={() => handleRatingToggle(rating)}
                    className="w-5 h-5 text-emerald-700 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <div className="flex items-center space-x-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <i
                          key={i}
                          className={`ri-star-${i < rating ? 'fill' : 'line'} text-sm ${
                            i < rating ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                        ></i>
                      ))}
                    </div>
                    <span className="text-gray-700 group-hover:text-gray-900">& Up</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6 space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => {
                  setInStock(e.target.checked);
                  applyFilters({ inStock: e.target.checked });
                }}
                className="w-5 h-5 text-emerald-700 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="text-gray-700 group-hover:text-gray-900">In Stock Only</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={onSale}
                onChange={(e) => {
                  setOnSale(e.target.checked);
                  applyFilters({ onSale: e.target.checked });
                }}
                className="w-5 h-5 text-emerald-700 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="text-gray-700 group-hover:text-gray-900">On Sale</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
