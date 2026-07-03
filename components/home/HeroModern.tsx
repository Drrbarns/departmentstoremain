'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Full-bleed editorial hero — a crossfading image carousel behind a soft
 * left-to-right scrim, a pill "eyebrow" badge, a serif headline and two
 * rounded CTAs. Slides under the transparent header on the homepage.
 * Revert via USE_NEW_DESIGN in lib/uiFlags.ts.
 */

const HERO_SLIDES = [
  { src: '/hero-1.png', alt: 'Discount Discovery Zone — fashion, bags and shoes' },
  { src: '/hero-2.png', alt: 'Discount Discovery Zone — electronics and home essentials' },
] as const;

const SLIDE_INTERVAL_MS = 3000;

export default function HeroModern() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (HERO_SLIDES.length < 2) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % HERO_SLIDES.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section
      className="relative isolate -mt-[4.25rem] min-h-[100svh] w-full overflow-hidden"
      aria-roledescription="carousel"
    >
      {/* Slides */}
      <div className="absolute inset-0">
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={slide.src}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              i === active ? 'z-[1] opacity-100' : 'z-0 opacity-0'
            }`}
            aria-hidden={i !== active}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={i === 0}
              sizes="100vw"
              quality={90}
              className="object-cover object-center"
            />
          </div>
        ))}
      </div>

      {/* Readability scrims */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-r from-black/60 via-black/25 to-transparent sm:from-black/55"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/40 via-transparent to-black/30"
        aria-hidden
      />

      {/* Slide dots */}
      {HERO_SLIDES.length > 1 && (
        <div
          className="pointer-events-none absolute bottom-6 left-1/2 z-[12] flex -translate-x-1/2 gap-2 sm:bottom-8"
          aria-hidden
        >
          {HERO_SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
              }`}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1200px] flex-col justify-center px-5 pb-16 pt-[5.5rem] sm:px-8 sm:pb-20 sm:pt-28 lg:px-10 lg:pb-24 lg:pt-32">
        <div className="max-w-xl">
          <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-gray-200/90 bg-white px-4 py-2.5 shadow-sm sm:px-5 sm:py-2">
            <i className="ri-star-fill text-[1.05rem] text-emerald-600 sm:text-lg" aria-hidden />
            <span className="font-sans text-[14px] font-semibold tracking-normal text-emerald-700 sm:text-[15px]">
              Everyday low prices
            </span>
          </div>

          <h1
            className="animate-fade-in-up mt-6 font-serif text-[2rem] font-semibold leading-[1.1] tracking-tight text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.5)] sm:text-4xl sm:leading-[1.08] lg:text-[2.75rem] lg:leading-[1.06]"
            style={{ animationDelay: '0.06s' }}
          >
            Everything You Need, All in One Store
          </h1>

          <p
            className="animate-fade-in-up mt-5 max-w-xl font-sans text-base font-normal leading-relaxed text-white/90 [text-shadow:0_1px_16px_rgba(0,0,0,0.5)] sm:text-[1.125rem] sm:leading-relaxed"
            style={{ animationDelay: '0.12s' }}
          >
            Fashion, bags, shoes, electronics and home essentials — quality products at unbeatable prices,
            delivered across Ghana.
          </p>

          <div
            className="animate-fade-in-up mt-8 flex flex-wrap items-center gap-3 sm:gap-4"
            style={{ animationDelay: '0.18s' }}
          >
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 font-sans text-sm font-semibold tracking-tight text-white transition-colors hover:bg-emerald-700 sm:px-8 sm:py-3.5 sm:text-base"
            >
              Shop Collection
              <i className="ri-arrow-right-line text-[1.05rem] sm:text-lg" aria-hidden />
            </Link>
            <Link
              href="/categories"
              className="inline-flex items-center justify-center rounded-full border-2 border-emerald-600 bg-white px-6 py-3 font-sans text-sm font-semibold tracking-tight text-emerald-700 transition-colors hover:bg-emerald-50/80 sm:px-8 sm:py-3.5 sm:text-base"
            >
              Browse Categories
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
