'use client';

import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import { usePageTitle } from '@/hooks/usePageTitle';

const values = [
  {
    icon: 'ri-verified-badge-line',
    title: 'Verified Quality',
    description:
      'Every product is personally inspected before it reaches you — sourced locally or imported, quality always comes first.',
  },
  {
    icon: 'ri-price-tag-3-line',
    title: 'Unbeatable Prices',
    description:
      'We source directly from manufacturers and local suppliers, cutting out the middleman and passing the savings to you.',
  },
  {
    icon: 'ri-global-line',
    title: 'Local & Imported',
    description:
      'The best of both worlds — handpicked local products alongside carefully selected imports from trusted suppliers.',
  },
  {
    icon: 'ri-user-heart-line',
    title: 'Customer First',
    description:
      'From your first order to every restock, friendly guidance and honest service are at the heart of what we do.',
  },
];

const trustPoints = [
  {
    icon: 'ri-award-line',
    title: 'Curated Selection',
    description: 'Dresses, electronics, bags, shoes and more — every item chosen with care.',
  },
  {
    icon: 'ri-truck-line',
    title: 'Nationwide Delivery',
    description: 'Fast, reliable delivery from Accra to every region across Ghana.',
  },
  {
    icon: 'ri-secure-payment-line',
    title: 'Secure Payments',
    description: 'Safe, trusted checkout with mobile money and card options.',
  },
  {
    icon: 'ri-customer-service-2-line',
    title: 'Personal Support',
    description: 'Friendly product guidance and order support whenever you need it.',
  },
];

export default function AboutPage() {
  usePageTitle('Our Story');
  const { getSetting } = useCMS();
  const siteName = getSetting('site_name') || 'Discount Discovery Zone';

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#ecfdf5] to-white py-20 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Our Story</p>
            <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-[#0B1B3A] sm:text-5xl lg:text-6xl">
              More Than Just
              <br />
              <span className="text-emerald-700">A Department Store</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600">
              Born from a passion for smart shopping, we make quality dresses, electronics, bags,
              shoes and more accessible to everyone — from Accra to your doorstep.
            </p>
          </div>
        </div>
      </section>

      {/* Brand Story */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="animate-in fade-in slide-in-from-left-6 duration-700">
              <div className="aspect-[4/5] overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5">
                <img
                  src="/hero-1.png"
                  alt={`${siteName} storefront`}
                  className="h-full w-full object-cover object-center"
                />
              </div>
            </div>

            <div className="space-y-6 animate-in fade-in slide-in-from-right-6 duration-700">
              <h2 className="font-serif text-3xl font-semibold text-[#0B1B3A] sm:text-4xl">The Beginning</h2>
              <div className="space-y-4 leading-relaxed text-gray-600">
                <p>
                  <strong className="text-[#0B1B3A]">{siteName}</strong> started with a simple idea:
                  bring quality products to Ghanaians at fair prices. We saw how people were paying too
                  much for items that could be sourced smarter — so we built a bridge between trusted
                  manufacturers, local suppliers, and everyday shoppers.
                </p>
                <p>
                  What began as a small operation in Accra grew into a full online store offering
                  everything from trendy dresses and stylish bags to the latest electronics and durable
                  shoes. We handpick every product, test it for quality, and price it fairly.
                </p>
                <p>
                  Whether you are shopping for yourself, stocking your boutique, or looking for the
                  perfect gift, we combine local sourcing with direct imports to give you the widest
                  selection at the best value.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl border-t border-gray-200" />

      {/* Values */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-3xl font-semibold text-[#0B1B3A] sm:text-4xl">What We Stand For</h2>
            <p className="mt-4 text-gray-600">
              The principles that guide every decision we make — from sourcing to delivery.
            </p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <div key={value.title} className="group text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#ecfdf5] transition-colors group-hover:bg-emerald-100">
                  <i className={`${value.icon} text-3xl text-emerald-700`}></i>
                </div>
                <h3 className="mt-5 font-serif text-lg font-semibold text-[#0B1B3A]">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="bg-gradient-to-b from-[#ecfdf5]/50 to-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-3xl font-semibold text-[#0B1B3A] sm:text-4xl">
              Why Shop With {siteName === 'Discount Discovery Zone' ? 'DDZ' : 'Us'}
            </h2>
            <p className="mt-4 text-gray-600">More than just a store — a commitment to excellence.</p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {trustPoints.map((point) => (
              <div
                key={point.title}
                className="rounded-2xl border border-[#d1fae5] bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <i className={`${point.icon} text-2xl text-emerald-700`}></i>
                <h3 className="mt-4 font-serif text-base font-semibold text-[#0B1B3A]">{point.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl font-semibold text-[#0B1B3A] sm:text-4xl">
            Ready to Shop Smarter?
          </h2>
          <p className="mt-4 text-gray-600">
            Discover our collection of dresses, electronics, bags, shoes and more — new stock arrives weekly.
          </p>
          <Link
            href="/shop"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-600/20"
          >
            Explore Categories
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </section>
    </div>
  );
}
