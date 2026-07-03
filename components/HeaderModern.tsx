'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MiniCart from './MiniCart';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { useCMS } from '@/context/CMSContext';
import AnnouncementBar from './AnnouncementBar';

/** Left of the centered logo — primary destinations (editorial layout). */
const LEFT_NAV_LINKS = [
  { label: 'Shop', href: '/shop' },
  { label: 'Categories', href: '/categories' },
  { label: 'Sale', href: '/sale' },
];

/** Full list for the mobile drawer. */
const SHEET_NAV_LINKS = [
  ...LEFT_NAV_LINKS,
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export default function HeaderModern() {
  const pathname = usePathname();
  const isHome = pathname === '/';

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [wishlistCount, setWishlistCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [heroSolid, setHeroSolid] = useState(false);

  const { cartCount, isCartOpen, setIsCartOpen } = useCart();
  const { getSetting } = useCMS();

  const siteName = getSetting('site_name') || 'Discount Discovery Zone';
  const siteLogo = getSetting('site_logo');
  const siteLogoWhite = getSetting('site_logo_white');
  // Over the dark hero the logo must read as light. Prefer a dedicated white
  // logo if one is configured; otherwise flip the (dark) logo to white via CSS.
  const heroLogoSrc = siteLogoWhite || siteLogo;
  const invertLogoOnHero = !siteLogoWhite;

  useEffect(() => {
    const updateWishlistCount = () => {
      const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
      setWishlistCount(wishlist.length);
    };
    updateWishlistCount();
    window.addEventListener('wishlistUpdated', updateWishlistCount);

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      window.removeEventListener('wishlistUpdated', updateWishlistCount);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isHome) {
      setHeroSolid(false);
      return;
    }
    const onScroll = () => setHeroSolid(window.scrollY > 2);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().replace(/\s+/g, ' ');
    if (q) {
      window.location.href = `/shop?search=${encodeURIComponent(q)}`;
    }
  };

  /** Home over the dark hero: light nav until scrolled, then a solid navy bar. */
  const onDarkHero = isHome && !heroSolid;

  const iconBtn = onDarkHero
    ? 'rounded-xl p-2 transition-colors text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.45)] hover:bg-white/15'
    : 'rounded-xl p-2 transition-colors text-[#0B1B3A] hover:bg-emerald-50';

  const badgeCls = onDarkHero
    ? 'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold bg-white text-[#0B1B3A] shadow-sm'
    : 'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold bg-emerald-600 text-white';

  const navLink = onDarkHero
    ? 'font-sans text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.55)] hover:text-white/90'
    : 'font-sans text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors text-[#0B1B3A] hover:text-emerald-700';

  return (
    <>
      <AnnouncementBar />

      <header
        className={`sticky top-0 z-50 transition-[background-color,box-shadow,backdrop-filter,border-color] duration-300 ${
          onDarkHero
            ? 'border-b border-transparent bg-transparent'
            : 'border-b border-[#d1fae5]/60 bg-white/95 shadow-sm backdrop-blur-md'
        }`}
      >
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10">
          {/* Mobile / tablet */}
          <div className="flex h-[4.25rem] items-center justify-between gap-3 lg:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className={`-ml-1 ${iconBtn}`}
                aria-label="Open menu"
              >
                <i className="ri-menu-line text-xl" />
              </button>
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className={`-ml-0.5 ${iconBtn}`}
                aria-label="Search"
              >
                <i className="ri-search-line text-xl" />
              </button>
            </div>

            <Link
              href="/"
              className="flex min-w-0 shrink items-center justify-center"
              aria-label={siteName}
            >
              {siteLogo ? (
                <img
                  src={onDarkHero ? heroLogoSrc : siteLogo}
                  alt={siteName}
                  className={`h-8 w-auto max-w-[min(42vw,10rem)] object-contain sm:h-9 ${
                    onDarkHero
                      ? `drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)] ${invertLogoOnHero ? 'brightness-0 invert' : ''}`
                      : ''
                  }`}
                />
              ) : (
                <span
                  className={`truncate font-serif text-lg font-semibold tracking-tight sm:text-xl ${
                    onDarkHero ? 'text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.5)]' : 'text-[#0B1B3A]'
                  }`}
                >
                  {siteName}
                </span>
              )}
            </Link>

            <div className="flex flex-1 items-center justify-end gap-0.5 sm:gap-1">
              <Link href="/wishlist" className={`relative ${iconBtn}`} aria-label="Wishlist">
                <i className="ri-heart-line text-xl" />
                {wishlistCount > 0 && <span className={badgeCls}>{wishlistCount}</span>}
              </Link>
              <button
                type="button"
                onClick={() => setIsCartOpen(!isCartOpen)}
                className={`relative ${iconBtn}`}
                aria-label="Cart"
              >
                <i className="ri-shopping-bag-line text-xl" />
                {cartCount > 0 && <span className={badgeCls}>{cartCount}</span>}
              </button>
              <Link
                href={user ? '/account' : '/auth/login'}
                className={`hidden sm:flex ${iconBtn}`}
                aria-label={user ? 'Account' : 'Login'}
              >
                <i className="ri-user-line text-xl" />
              </Link>
            </div>
          </div>

          {/* Desktop — editorial layout */}
          <div className="hidden h-[4.25rem] grid-cols-[1fr_auto_1fr] items-center gap-4 lg:grid">
            <div className="flex min-w-0 items-center gap-5">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className={iconBtn}
                aria-label="Search"
              >
                <i className="ri-search-line text-[1.15rem]" />
              </button>
              <nav className="flex items-center gap-7">
                {LEFT_NAV_LINKS.map((link) => (
                  <Link key={link.label + link.href} href={link.href} className={navLink}>
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex justify-center px-4">
              <Link href="/" className="flex items-center" aria-label={siteName}>
                {siteLogo ? (
                  <img
                    src={onDarkHero ? heroLogoSrc : siteLogo}
                    alt={siteName}
                    className={`h-10 w-auto max-w-[14rem] object-contain xl:h-11 ${
                      onDarkHero
                        ? `drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)] ${invertLogoOnHero ? 'brightness-0 invert' : ''}`
                        : ''
                    }`}
                  />
                ) : (
                  <span
                    className={`font-serif text-2xl font-semibold tracking-tight ${
                      onDarkHero ? 'text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.5)]' : 'text-[#0B1B3A]'
                    }`}
                  >
                    {siteName}
                  </span>
                )}
              </Link>
            </div>

            <div className="flex min-w-0 items-center justify-end gap-8">
              <button type="button" onClick={() => setIsCartOpen(!isCartOpen)} className={`relative cursor-pointer ${navLink}`}>
                Cart
                {cartCount > 0 && <span className={badgeCls}>{cartCount}</span>}
              </button>
              <Link href="/wishlist" className={`relative ${navLink}`}>
                Wishlist
                {wishlistCount > 0 && <span className={badgeCls}>{wishlistCount}</span>}
              </Link>
              <Link href="/about" className={navLink}>
                About
              </Link>
              <Link href={user ? '/account' : '/auth/login'} className={`ml-1 ${iconBtn}`} aria-label={user ? 'Account' : 'Login'}>
                <i className="ri-user-line text-[1.15rem]" />
              </Link>
            </div>
          </div>
        </div>

        {/* MiniCart anchored to the header so it opens over the page */}
        <MiniCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      </header>

      {isSearchOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-start justify-center pt-24" onClick={() => setIsSearchOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-xl font-semibold text-[#0B1B3A]">Search Products</h3>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700"
                  aria-label="Close search"
                >
                  <i className="ri-close-line text-2xl" />
                </button>
              </div>
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, SKU, barcode, or store code (e.g. 042)..."
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 text-base"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#0B1B3A] hover:text-emerald-700"
                    aria-label="Submit search"
                  >
                    <i className="ri-search-line text-xl" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-0 left-0 bottom-0 w-4/5 max-w-xs bg-white shadow-xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-4 border-b border-[#d1fae5]/40 flex items-center justify-between">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                {siteLogo ? (
                  <img src={siteLogo} alt={siteName} className="h-8 w-auto object-contain" />
                ) : (
                  <span className="font-serif text-lg font-semibold text-[#0B1B3A] tracking-tight">{siteName}</span>
                )}
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 -mr-2 text-gray-500 hover:text-[#0B1B3A]"
                aria-label="Close menu"
              >
                <i className="ri-close-line text-2xl" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {[{ label: 'Home', href: '/' }, ...SHEET_NAV_LINKS].map((link) => (
                <Link
                  key={link.label + link.href}
                  href={link.href}
                  className={`block px-4 py-3 text-lg font-medium rounded-xl transition-colors ${
                    link.label === 'Sale'
                      ? 'text-emerald-700 hover:bg-emerald-50'
                      : 'text-[#0B1B3A] hover:bg-emerald-50'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="h-px bg-[#d1fae5]/40 my-2" />
              {[
                { label: 'Track Order', href: '/order-tracking' },
                { label: 'Wishlist', href: '/wishlist' },
                { label: 'My Account', href: '/account' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 text-base font-medium text-gray-600 hover:bg-emerald-50 hover:text-[#0B1B3A] rounded-xl transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t border-[#d1fae5]/40">
              <p className="text-xs text-gray-500 text-center">
                &copy; {new Date().getFullYear()} {siteName}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
