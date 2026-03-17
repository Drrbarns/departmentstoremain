'use client';

import { useState, useEffect } from 'react';
import { useCMS } from '@/context/CMSContext';

export default function PWASplash() {
  const { getSetting } = useCMS();
  const logoWhite = getSetting('site_logo_white');
  const logoDark = getSetting('site_logo');
  const logoUrl = logoWhite || logoDark || '/icons/icon-192x192.png';
  const useInvert = !logoWhite && !!logoDark;
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Only show splash in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    // Only show on first load (not on subsequent navigations)
    const hasShownSplash = sessionStorage.getItem('splashShown');

    if (isStandalone && !hasShownSplash) {
      setShowSplash(true);
      sessionStorage.setItem('splashShown', 'true');

      const timer = setTimeout(() => setShowSplash(false), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!showSplash) return null;

  return (
    <div className="pwa-splash" aria-hidden="true">
      <div className="pwa-splash-logo mb-6">
        <img
          src={logoUrl}
          alt="Discount Discovery Zone"
          className={`w-24 h-24 object-contain ${useInvert ? 'brightness-0 invert' : ''}`}
        />
      </div>
      <h1 className="text-white text-xl font-bold font-serif mb-2">Discount Discovery Zone</h1>
      <p className="text-blue-200 text-sm font-medium mb-8">Dresses, Electronics, Bags & More</p>
      <div className="pwa-splash-dots flex gap-1.5">
        <span className="w-2 h-2 bg-white rounded-full" />
        <span className="w-2 h-2 bg-white rounded-full" />
        <span className="w-2 h-2 bg-white rounded-full" />
      </div>
    </div>
  );
}
