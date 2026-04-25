'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import CartCountdown from '@/components/CartCountdown';
import { useCart } from '@/context/CartContext';
import PageHero from '@/components/PageHero';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function CartPage() {
  usePageTitle('Shopping Cart');
  const { cart: cartItems, removeFromCart, updateQuantity, subtotal, addToCart } = useCart();
  const [savedItems, setSavedItems] = useState<any[]>([]);

  // Function to move item to saved for later (local state only for now)
  const saveForLater = (id: string) => {
    const item = cartItems.find(item => item.id === id);
    if (item) {
      setSavedItems([...savedItems, item]);
      removeFromCart(item.id, item.variant, item.variantId); // Use context's removeFromCart
    }
  };

  const moveToCart = (id: string) => {
    const item = savedItems.find(item => item.id === id);
    if (item) {
      // addToCart expects a CartItem object which already includes quantity
      addToCart(item);
      setSavedItems(savedItems.filter(item => item.id !== id));
    }
  };

  // Savings calculation is tricky without originalPrice in Context.
  // Assuming 0 for now unless we update Context.
  const savings = 0;

  const shipping = subtotal >= 200 ? 0 : 15;
  const total = subtotal + shipping;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHero title="Shopping Cart" />
      <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <CartCountdown />
        {/* <FreeShippingBar currentAmount={subtotal} threshold={200} /> */}

        {cartItems.length === 0 && savedItems.length === 0 ? (
          <section className="py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
              <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6 bg-gray-200 rounded-full">
                <i className="ri-shopping-cart-line text-5xl text-gray-400"></i>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Your cart is empty</h2>
              <p className="text-gray-600 mb-8 text-lg">Looks like you&#39;t added anything to your cart yet</p>
              <Link href="/shop" className="inline-block bg-gray-900 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold transition-colors whitespace-nowrap">
                Continue Shopping
              </Link>
            </div>
          </section>
        ) : (
          <section className="py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-gray-900">Cart Items ({cartItems.length})</h2>
                      {savings > 0 && (
                        <span className="text-blue-700 font-semibold">You save GH₵{savings.toFixed(2)}</span>
                      )}
                    </div>

                    <div className="space-y-6">
                      {cartItems.map((item) => (
                        <div key={`${item.id}-${item.variantId || item.variant || ''}`} className="flex flex-col sm:flex-row gap-4 sm:gap-6 pb-6 border-b border-gray-200 last:border-0 last:pb-0">
                          <Link href={`/product/${item.slug || item.id}`} className="relative w-full sm:w-32 h-48 sm:h-32 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                            <Image src={item.image} alt={item.name} fill className="object-cover object-top" sizes="(max-width: 640px) 100vw, 128px" quality={70} />
                          </Link>

                          <div className="flex-1">
                            <div className="flex justify-between mb-2">
                              <Link href={`/product/${item.slug || item.id}`} className="text-lg font-semibold text-gray-900 hover:text-blue-700 transition-colors line-clamp-2">
                                {item.name}
                              </Link>
                              <button
                                onClick={() => removeFromCart(item.id, item.variant, item.variantId)}
                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <i className="ri-close-line text-xl"></i>
                              </button>
                            </div>

                            <div className="text-sm text-gray-600 mb-3 space-y-1">
                              {item.variant && <p>Variant: {item.variant}</p>}
                              {/* Stock status assuming always available if in cart for now */}
                              <p className="text-blue-600 font-medium">In Stock</p>
                            </div>

                            <div className="flex items-center justify-between flex-wrap gap-4">
                              <div className="flex items-baseline space-x-3">
                                <span className="text-xl font-bold text-gray-900">GH₵{item.price.toFixed(2)}</span>
                              </div>

                              <div className="flex items-center space-x-4">
                                <div className="flex flex-col">
                                  <div className="flex items-center border-2 border-gray-300 rounded-lg">
                                    <button
                                      onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant, item.variantId)}
                                      className="w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                                      title={item.quantity <= (item.moq || 1) ? 'Remove item' : 'Decrease quantity'}
                                    >
                                      {item.quantity <= (item.moq || 1) ? (
                                        <i className="ri-delete-bin-line text-red-500"></i>
                                      ) : (
                                        <i className="ri-subtract-line"></i>
                                      )}
                                    </button>
                                    <input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || (item.moq || 1), item.variant, item.variantId)}
                                      className="w-12 h-10 text-center border-x-2 border-gray-300 focus:outline-none font-semibold"
                                      min={item.moq || 1}
                                      max={item.maxStock}
                                    />
                                    <button
                                      onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant, item.variantId)}
                                      className="w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                                    >
                                      <i className="ri-add-line"></i>
                                    </button>
                                  </div>
                                  {(item.moq || 1) > 1 && (
                                    <span className="text-xs text-amber-600 mt-1">
                                      Min. order: {item.moq} units
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Saved for later functionality temporarily disabled until fully implemented with Context integration if requested */}
                            {/*
                            <button
                              onClick={() => saveForLater(item.id)}
                              className="mt-3 text-sm text-blue-700 hover:text-blue-900 font-medium whitespace-nowrap"
                            >
                              Save for Later
                            </button>
                            */}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {savedItems.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">Saved for Later ({savedItems.length})</h3>
                      <div className="space-y-4">
                        {savedItems.map((item) => (
                          <div key={item.id} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                            <div className="relative w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                              <Image src={item.image} alt={item.name} fill className="object-cover object-top" sizes="80px" quality={60} />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 mb-1">{item.name}</p>
                              <p className="text-lg font-bold text-gray-900 mb-2">GH₵{item.price.toFixed(2)}</p>
                              {/* Move to cart disabled for now */}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
                    <h3 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h3>

                    <div className="space-y-4 mb-6">
                      <div className="flex justify-between text-gray-700">
                        <span>Subtotal</span>
                        <span className="font-semibold">GH₵{subtotal.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-gray-700">
                        <span>Shipping</span>
                        <span className="font-semibold text-gray-500">Calculated at checkout</span>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4 mb-6">
                      <div className="flex justify-between text-xl font-bold text-gray-900">
                        <span>Total</span>
                        <span>GH₵{total.toFixed(2)}</span>
                      </div>
                    </div>

                    <Link
                      href="/checkout"
                      className="block w-full bg-blue-700 hover:bg-blue-800 text-white py-4 rounded-lg font-semibold text-center transition-colors mt-6 mb-3 whitespace-nowrap"
                    >
                      Proceed to Checkout
                    </Link>

                    <Link
                      href="/shop"
                      className="block w-full text-center text-blue-700 hover:text-blue-900 font-semibold py-2 whitespace-nowrap"
                    >
                      Continue Shopping
                    </Link>

                    <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <i className="ri-shield-check-line text-blue-700 mr-2"></i>
                        <span>Secure checkout</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <i className="ri-arrow-left-right-line text-blue-700 mr-2"></i>
                        <span>Easy returns</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <i className="ri-customer-service-line text-blue-700 mr-2"></i>
                        <span>24/7 support</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
