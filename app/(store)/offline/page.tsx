'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      window.location.href = '/';
    }
  }, [isOnline]);

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.href = '/';
      } else {
        setRetrying(false);
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {/* Animated illustration */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto relative">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-emerald-100 animate-pulse" />
            {/* Inner circle */}
            <div className="absolute inset-3 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
              <div className="relative">
                <i className="ri-wifi-off-line text-5xl text-emerald-600" />
                {/* Animated dots */}
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <h1 className="font-serif text-3xl font-bold text-gray-900 mb-3">
          You&apos;re Offline
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          No worries! Check your connection and try again.
          You can still browse pages you&apos;ve visited before.
        </p>

        {/* Available actions */}
        <div className="space-y-3 mb-8">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white py-4 px-6 rounded-2xl font-semibold transition-all active:scale-[0.98] shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2"
          >
            {retrying ? (
              <>
                <i className="ri-loader-4-line text-xl pull-refresh-spinner" />
                Checking connection...
              </>
            ) : (
              <>
                <i className="ri-refresh-line text-xl" />
                Try Again
              </>
            )}
          </button>

          <Link
            href="/"
            className="w-full bg-white hover:bg-gray-50 text-gray-700 py-4 px-6 rounded-2xl font-semibold transition-all border border-gray-200 flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
          >
            <i className="ri-home-line text-xl" />
            Go to Cached Home
          </Link>
        </div>

        {/* Tips */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2 justify-center">
            <i className="ri-lightbulb-line text-amber-500" />
            While offline you can:
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: 'ri-eye-line', text: 'View cached pages' },
              { icon: 'ri-shopping-cart-line', text: 'Check your cart' },
              { icon: 'ri-heart-line', text: 'Browse wishlist' },
              { icon: 'ri-image-line', text: 'See saved images' },
            ].map((tip) => (
              <div
                key={tip.text}
                className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2"
              >
                <i className={`${tip.icon} text-emerald-600 text-sm`} />
                <span>{tip.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status indicator */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-400'} ${!isOnline && 'animate-pulse'}`} />
          <span className="text-xs text-gray-400 font-medium">
            {isOnline ? 'Connected' : 'No connection'}
          </span>
        </div>
      </div>
    </div>
  );
}
