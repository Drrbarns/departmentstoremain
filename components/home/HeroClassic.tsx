'use client';

import Link from 'next/link';
import Image from 'next/image';

/**
 * The previous homepage hero (banners + full-bleed image with overlaid
 * features and the floating "25% off" card). Preserved so the homepage can
 * revert by flipping USE_NEW_DESIGN in lib/uiFlags.ts.
 */

const config = {
  hero: {
    backgroundImage: '/home-hero-mall.png',
  },
  banners: [
    { text: '🚚 Doorstep delivery available across Ghana — pickup is free in Accra!', active: false },
    { text: '✨ New stock arriving this weekend - Pre-order now!', active: false },
    { text: '💳 Secure payments via Mobile Money & Card', active: false },
  ],
};

export default function HeroClassic() {
  const heroImage = config.hero.backgroundImage || '/logo.png';

  const activeBanners = config.banners.filter((b) => b.active);

  return (
    <>
      {activeBanners.length > 0 && (
        <div className="bg-emerald-900 text-white py-2 overflow-hidden relative">
          <div className="flex animate-marquee whitespace-nowrap">
            {activeBanners.concat(activeBanners).map((banner, index) => (
              <span key={index} className="mx-8 text-sm font-medium tracking-wide flex items-center">
                {banner.text}
              </span>
            ))}
          </div>
        </div>
      )}

      <section className="relative w-full h-[70vh] md:h-[90vh] overflow-hidden bg-black">
        <div className="absolute inset-0 z-10">
          <Image
            src={heroImage}
            alt="Hero — Discount Discovery Zone"
            fill
            className="object-cover"
            priority
            quality={90}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/60" />
          <div className="absolute inset-0 bg-black/20" />

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 max-w-5xl mx-auto mt-[-50px]">
            <p className="text-white/90 text-sm md:text-base tracking-[0.2em] uppercase font-medium mb-6 animate-fade-in-up">
              Discount Discovery Zone Department Store
            </p>

            <h1
              className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-serif text-white mb-6 leading-tight drop-shadow-lg animate-fade-in-up"
              style={{ animationDelay: '0.1s' }}
            >
              Everything You Need, <br />
              <span className="italic font-light">All in One Store</span>
            </h1>

            <p
              className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10 font-light tracking-wide animate-fade-in-up"
              style={{ animationDelay: '0.2s' }}
            >
              Shop fashion, bags, shoes, electronics, home essentials, beauty, and more - all at unbeatable prices.
            </p>

            <div
              className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 animate-fade-in-up"
              style={{ animationDelay: '0.3s' }}
            >
              <Link
                href="/shop"
                className="bg-white text-gray-900 px-8 py-3 sm:px-10 sm:py-4 rounded-full font-medium text-base sm:text-lg hover:bg-gray-100 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 duration-300"
              >
                Shop Now
              </Link>
              <Link
                href="/shop"
                className="px-8 py-3 sm:px-10 sm:py-4 rounded-full font-medium text-base sm:text-lg text-white border border-white/40 hover:bg-white/10 transition-colors backdrop-blur-sm"
              >
                Browse Categories
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Features (Desktop) */}
        <div className="absolute bottom-12 left-0 right-0 z-20 hidden md:flex justify-center items-center gap-16 text-white text-center">
          <div>
            <p className="font-serif text-lg font-medium">Direct Import</p>
            <p className="text-xs text-white/60 font-light tracking-wide uppercase mt-1">From China &amp; Local Suppliers</p>
          </div>
          <div className="w-px h-10 bg-white/20"></div>
          <div>
            <p className="font-serif text-lg font-medium">Verified Quality</p>
            <p className="text-xs text-white/60 font-light tracking-wide uppercase mt-1">Every Item Checked</p>
          </div>
          <div className="w-px h-10 bg-white/20"></div>
          <div>
            <p className="font-serif text-lg font-medium">Best Prices</p>
            <p className="text-xs text-white/60 font-light tracking-wide uppercase mt-1">Wholesale &amp; Retail</p>
          </div>
        </div>

        {/* Floating "Exclusive Offer" Card (Bottom Left) */}
        <div className="absolute bottom-8 left-8 md:bottom-12 md:left-12 z-20 bg-white rounded-xl p-6 shadow-2xl max-w-[280px] animate-fade-in hidden lg:block">
          <p className="font-serif text-emerald-800 text-lg italic mb-0.5">Exclusive Offer</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">25% Off</h3>
          <p className="text-xs text-gray-500 font-medium leading-relaxed">
            On your first order. <br />
            <Link href="/shop" className="underline text-emerald-700 hover:text-emerald-900 mt-1 inline-block">Shop now</Link>
          </p>
        </div>
      </section>
    </>
  );
}
