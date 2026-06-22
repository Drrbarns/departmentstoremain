'use client';

import Link from 'next/link';
import Image from 'next/image';

/**
 * Clean, minimal homepage hero — one headline, one primary action, and a
 * quiet supporting link. Trust signals live in a slim strip below the image
 * instead of being overlaid on it. Revert via USE_NEW_DESIGN in lib/uiFlags.ts.
 */

const HERO_IMAGE = '/home-hero-mall.png';

const TRUST = [
  { icon: 'ri-ship-line', label: 'Delivery across Ghana' },
  { icon: 'ri-shield-check-line', label: 'Verified quality' },
  { icon: 'ri-price-tag-3-line', label: 'Wholesale & retail prices' },
  { icon: 'ri-secure-payment-line', label: 'Secure payments' },
];

export default function HeroModern() {
  return (
    <section className="relative w-full">
      <div className="relative w-full h-[72vh] min-h-[460px] md:h-[80vh] overflow-hidden bg-black">
        <Image
          src={HERO_IMAGE}
          alt="Discount Discovery Zone"
          fill
          className="object-cover"
          priority
          quality={90}
        />
        {/* Single soft overlay — darker at the bottom for legible text */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/40 to-black/70" />

        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-5">
          <p className="text-white/80 text-xs md:text-sm tracking-[0.25em] uppercase mb-5 animate-fade-in-up">
            Department Store
          </p>

          <h1
            className="text-4xl sm:text-5xl md:text-7xl font-serif text-white leading-[1.05] max-w-4xl animate-fade-in-up"
            style={{ animationDelay: '0.1s' }}
          >
            Everything you need,
            <br />
            <span className="italic font-light">all in one store</span>
          </h1>

          <p
            className="mt-6 text-base md:text-lg text-white/75 max-w-xl font-light animate-fade-in-up"
            style={{ animationDelay: '0.2s' }}
          >
            Fashion, bags, shoes, electronics and home essentials — at unbeatable prices.
          </p>

          <div
            className="mt-9 flex items-center gap-6 animate-fade-in-up"
            style={{ animationDelay: '0.3s' }}
          >
            <Link
              href="/shop"
              className="bg-white text-gray-900 px-9 py-3.5 rounded-full font-medium text-base hover:bg-gray-100 transition-all shadow-lg hover:-translate-y-0.5 duration-300"
            >
              Shop Now
            </Link>
            <Link
              href="/categories"
              className="group inline-flex items-center gap-2 text-white/90 font-medium text-base hover:text-white transition-colors"
            >
              Browse categories
              <i className="ri-arrow-right-line transition-transform group-hover:translate-x-1"></i>
            </Link>
          </div>
        </div>
      </div>

      {/* Slim, separate trust strip — calm, not overlaid on the image */}
      <div className="border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ul className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
            {TRUST.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-center gap-2.5 py-4 md:py-5 text-center"
              >
                <i className={`${item.icon} text-lg text-gray-400`}></i>
                <span className="text-[11px] md:text-xs tracking-wide uppercase text-gray-600 font-medium">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
