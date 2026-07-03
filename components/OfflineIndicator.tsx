'use client';

import { useState, useEffect } from 'react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowToast(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  if (!showToast) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-500 ${
        showToast ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <div
        className={`${
          isOnline
            ? 'bg-emerald-600'
            : 'bg-gray-900'
        } text-white`}
      >
        <div className="safe-area-top" />
        <div className="flex items-center justify-center gap-2 py-3 px-4">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-300 animate-pulse' : 'bg-red-400'}`} />
          <i className={`text-lg ${isOnline ? 'ri-wifi-line' : 'ri-wifi-off-line'}`} />
          <span className="font-medium text-sm">
            {isOnline ? 'Back online' : 'No internet connection'}
          </span>
          {!isOnline && (
            <span className="text-xs opacity-70 ml-1">
              - browsing cached content
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
