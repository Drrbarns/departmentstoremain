'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useState, useEffect } from 'react';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isStandalone, setIsStandalone] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  useEffect(() => {
    // Detect standalone PWA mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Hide on scroll down, show on scroll up (only when scrolled far enough)
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const navItems = [
    {
      href: '/',
      label: 'Home',
      iconActive: 'ri-home-5-fill',
      iconInactive: 'ri-home-5-line',
    },
    {
      href: '/shop',
      label: 'Shop',
      iconActive: 'ri-store-3-fill',
      iconInactive: 'ri-store-3-line',
    },
    {
      href: '/cart',
      label: 'Cart',
      iconActive: 'ri-shopping-cart-fill',
      iconInactive: 'ri-shopping-cart-line',
      badge: cartCount,
    },
    {
      href: '/wishlist',
      label: 'Wishlist',
      iconActive: 'ri-heart-3-fill',
      iconInactive: 'ri-heart-3-line',
      badge: wishlistCount,
    },
    {
      href: '/account',
      label: 'Account',
      iconActive: 'ri-user-3-fill',
      iconInactive: 'ri-user-3-line',
    },
  ];

  return (
    <nav
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-label="Mobile navigation"
    >
      {/* Frosted glass background */}
      <div className="relative">
        {/* Top shadow gradient */}
        <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-t from-white/80 to-transparent pointer-events-none" />
        
        <div className="bg-white/90 backdrop-blur-xl border-t border-gray-200/60 shadow-[0_-4px_30px_rgba(0,0,0,0.08)]">
          <div className={`grid grid-cols-5 ${isStandalone ? 'pb-6' : 'pb-1'} pt-1`}>
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center py-2 transition-all duration-200 relative group active:scale-90 ${
                    active ? 'text-emerald-700' : 'text-gray-400'
                  }`}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  {/* Active indicator pill */}
                  {active && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-emerald-600 rounded-full transition-all duration-300" />
                  )}
                  
                  <div className="relative w-7 h-7 flex items-center justify-center">
                    <i
                      className={`${active ? item.iconActive : item.iconInactive} text-[22px] transition-all duration-200 ${
                        active ? 'scale-110' : 'group-hover:scale-105'
                      }`}
                    />
                    
                    {/* Badge */}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm animate-scale-in">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  
                  <span className={`text-[10px] font-semibold mt-0.5 transition-all duration-200 ${
                    active ? 'opacity-100' : 'opacity-70'
                  }`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
