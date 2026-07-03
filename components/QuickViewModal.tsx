'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  images?: string[];
  category: string;
  description: string;
  inStock: boolean;
  stockCount: number;
  colors?: string[];
  sizes?: string[];
}

interface QuickViewModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickViewModal({ product, isOpen, onClose }: QuickViewModalProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0] || '');
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || '');
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  const images = product.images || [product.image];

  const handleAddToCart = () => {
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-75"
          onClick={onClose}
        ></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
            >
              <i className="ri-close-line text-2xl text-gray-700"></i>
            </button>
          </div>

          <div className="bg-white p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                  <Image
                    src={images[selectedImage]}
                    alt={product.name}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    quality={75}
                  />
                </div>

                {images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        className={`relative aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 transition-colors ${
                          selectedImage === index ? 'border-emerald-700' : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <Image src={image} alt="" fill className="object-cover object-top" sizes="12vw" quality={50} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col">
                <div className="mb-2">
                  <Link 
                    href={`/categories?category=${product.category}`}
                    className="text-sm text-emerald-700 hover:text-emerald-800 font-medium whitespace-nowrap"
                  >
                    {product.category}
                  </Link>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-3">{product.name}</h2>

                <div className="flex items-center space-x-3 mb-4">
                  <div className="flex items-center space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <i
                        key={i}
                        className={`${
                          i < Math.floor(product.rating)
                            ? 'ri-star-fill text-yellow-400'
                            : 'ri-star-line text-gray-300'
                        }`}
                      ></i>
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">({product.reviews} reviews)</span>
                </div>

                <div className="flex items-baseline space-x-3 mb-4">
                  <span className="text-3xl font-bold text-gray-900">GH₵{product.price.toFixed(2)}</span>
                  {product.originalPrice && (
                    <>
                      <span className="text-lg text-gray-400 line-through">GH₵{product.originalPrice.toFixed(2)}</span>
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded whitespace-nowrap">
                        Save {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                      </span>
                    </>
                  )}
                </div>

                <p className="text-gray-600 mb-6 line-clamp-3">{product.description}</p>

                {product.colors && product.colors.length > 0 && (
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Colour: {selectedColor}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {product.colors.map((color) => (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          className={`px-4 py-2 border-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                            selectedColor === color
                              ? 'border-emerald-700 bg-emerald-50 text-emerald-700'
                              : 'border-gray-300 hover:border-gray-400 text-gray-700'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {product.sizes && product.sizes.length > 0 && (
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Size: {selectedSize}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {product.sizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`px-4 py-2 border-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                            selectedSize === size
                              ? 'border-emerald-700 bg-emerald-50 text-emerald-700'
                              : 'border-gray-300 hover:border-gray-400 text-gray-700'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Quantity</label>
                  <div className="flex items-center border-2 border-gray-300 rounded-lg w-32">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-12 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <i className="ri-subtract-line"></i>
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(product.stockCount, parseInt(e.target.value) || 1)))}
                      className="w-12 h-12 text-center border-x-2 border-gray-300 focus:outline-none font-semibold"
                      min="1"
                      max={product.stockCount}
                    />
                    <button
                      onClick={() => setQuantity(Math.min(product.stockCount, quantity + 1))}
                      className="w-10 h-12 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <i className="ri-add-line"></i>
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {product.inStock ? `${product.stockCount} in stock` : 'Out of stock'}
                  </p>
                </div>

                <div className="space-y-3 mt-auto">
                  <button
                    onClick={handleAddToCart}
                    disabled={!product.inStock}
                    className={`w-full py-4 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                      addedToCart
                        ? 'bg-green-600 text-white'
                        : product.inStock
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {addedToCart ? (
                      <span className="flex items-center justify-center">
                        <i className="ri-check-line mr-2"></i>
                        Added to Cart
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <i className="ri-shopping-cart-line mr-2"></i>
                        Add to Cart
                      </span>
                    )}
                  </button>

                  <Link
                    href={`/product/${product.id}`}
                    className="block w-full py-4 border-2 border-gray-900 text-gray-900 rounded-lg font-semibold text-center hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    View Full Details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
