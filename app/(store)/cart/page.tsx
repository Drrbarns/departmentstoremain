'use client';

import Link from 'next/link';
import Image from 'next/image';
import CartCountdown from '@/components/CartCountdown';
import { useCart } from '@/context/CartContext';
import { useAffiliate } from '@/context/AffiliateContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getOptimizedImageUrl } from '@/lib/imageOptimization';

export default function CartPage() {
  usePageTitle('Shopping Cart');
  const { cart: cartItems, removeFromCart, updateQuantity } = useCart();
  const { mk } = useAffiliate();

  // Cart stores base prices; affiliate markup is applied for display + the
  // running subtotal here, then re-priced authoritatively server-side.
  const subtotal = cartItems.reduce((sum, item) => sum + mk(item.price, item.id) * item.quantity, 0);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = subtotal;

  return (
    <main className="bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="py-6">
          <ol className="flex items-center gap-2 text-sm text-gray-500">
            <li>
              <Link href="/" className="transition-colors hover:text-emerald-700">Home</Link>
            </li>
            <li><i className="ri-arrow-right-s-line"></i></li>
            <li className="font-medium text-[#0B1B3A]">Your Bag</li>
          </ol>
        </nav>

        <div className="mb-8">
          <h1 className="font-serif text-4xl font-semibold text-[#0B1B3A] sm:text-5xl">
            Your Bag
            {itemCount > 0 && (
              <span className="ml-3 text-xl font-normal text-gray-400 sm:text-2xl">
                ({itemCount} {itemCount === 1 ? 'item' : 'items'})
              </span>
            )}
          </h1>
        </div>

        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex size-28 items-center justify-center rounded-full bg-emerald-50">
              <i className="ri-shopping-bag-3-line text-5xl text-emerald-600/50"></i>
            </div>
            <h3 className="mt-8 font-serif text-2xl font-semibold text-[#0B1B3A]">Your bag is empty</h3>
            <p className="mt-2 text-gray-500">Discover something you&apos;ll love</p>
            <Link
              href="/shop"
              className="mt-8 rounded-full bg-emerald-600 px-10 py-3.5 text-base font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid gap-10 pb-16 lg:grid-cols-[1fr_380px] lg:gap-14">
            {/* Items */}
            <div>
              <CartCountdown />
              <div className="space-y-4">
                {cartItems.map((item) => {
                  const linePrice = mk(item.price, item.id);
                  return (
                    <div
                      key={`${item.id}-${item.variantId || item.variant || ''}`}
                      className="rounded-2xl border border-[#d1fae5] bg-white px-5 py-5 shadow-[0_8px_26px_-20px_rgba(11,27,58,0.45)]"
                    >
                      <div className="flex gap-4 sm:gap-5">
                        <Link href={`/product/${item.slug || item.id}`} className="shrink-0">
                          <div className="size-[76px] overflow-hidden rounded-xl bg-emerald-50 ring-1 ring-black/5 sm:size-[88px]">
                            <Image
                              src={getOptimizedImageUrl(item.image, { width: 200 })}
                              alt={item.name}
                              width={88}
                              height={88}
                              unoptimized
                              className="size-full object-cover object-top"
                            />
                          </div>
                        </Link>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/product/${item.slug || item.id}`}
                                className="font-serif text-lg font-semibold leading-tight text-[#0B1B3A] transition-colors hover:text-emerald-700 line-clamp-2"
                              >
                                {item.name}
                              </Link>
                              {item.variant && (
                                <p className="mt-1 text-sm text-gray-500">{item.variant}</p>
                              )}
                              <p className="mt-2 text-xl font-semibold leading-none text-emerald-700">
                                GH₵{linePrice.toFixed(2)}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id, item.variant, item.variantId)}
                              className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              aria-label="Remove item"
                            >
                              <i className="ri-delete-bin-line text-lg"></i>
                            </button>
                          </div>

                          <div className="mt-4 flex items-end justify-between gap-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant, item.variantId)}
                                  className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-colors hover:bg-emerald-200"
                                  aria-label="Decrease quantity"
                                >
                                  {item.quantity <= (item.moq || 1) ? (
                                    <i className="ri-delete-bin-line text-red-500"></i>
                                  ) : (
                                    <i className="ri-subtract-line"></i>
                                  )}
                                </button>
                                <span className="w-8 text-center text-base font-semibold text-[#0B1B3A]">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant, item.variantId)}
                                  className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-colors hover:bg-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                  disabled={item.quantity >= item.maxStock}
                                  aria-label="Increase quantity"
                                >
                                  <i className="ri-add-line"></i>
                                </button>
                              </div>
                              {(item.moq || 1) > 1 && (
                                <span className="text-xs text-amber-600">Min. order: {item.moq} units</span>
                              )}
                            </div>

                            <div className="text-right">
                              <p className="text-sm text-gray-500">Subtotal</p>
                              <span className="text-xl font-semibold leading-none text-[#0B1B3A]">
                                GH₵{(linePrice * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div>
              <div className="sticky top-24 overflow-hidden rounded-2xl border border-[#d1fae5] bg-[#ecfdf5] shadow-[0_14px_34px_-24px_rgba(11,27,58,0.5)]">
                <div className="space-y-5 p-6">
                  <h3 className="font-serif text-2xl font-semibold text-[#0B1B3A]">Order Summary</h3>

                  <div className="space-y-3.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-semibold text-[#0B1B3A]">GH₵{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Shipping</span>
                      <span className="font-medium text-gray-500">Calculated at checkout</span>
                    </div>
                  </div>

                  <div className="h-px bg-[#d1fae5]" />

                  <div className="flex items-center justify-between">
                    <span className="text-xl font-semibold text-[#0B1B3A]">Total</span>
                    <span className="text-2xl font-semibold leading-none text-emerald-700">GH₵{total.toFixed(2)}</span>
                  </div>

                  <Link
                    href="/checkout"
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-4 text-base font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    <i className="ri-bank-card-line"></i>
                    Proceed to Checkout
                  </Link>

                  <Link
                    href="/shop"
                    className="flex w-full items-center justify-center rounded-full border border-emerald-600/70 py-4 text-base font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                  >
                    Continue Shopping
                  </Link>

                  <div className="space-y-2 pt-1 text-sm text-gray-500">
                    <p className="flex items-center gap-2">
                      <i className="ri-truck-line text-emerald-700"></i>
                      Fast, reliable delivery across Ghana
                    </p>
                    <p className="flex items-center gap-2">
                      <i className="ri-shield-check-line text-emerald-700"></i>
                      Secure checkout &amp; trusted payments
                    </p>
                    <p className="flex items-center gap-2">
                      <i className="ri-customer-service-2-line text-emerald-700"></i>
                      Friendly support whenever you need it
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
