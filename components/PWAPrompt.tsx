'use client';

import { useState, useEffect } from 'react';
import { usePWAInstall } from './PWAInstaller';

export default function PWAPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const { canInstall, isInstalled, install } = usePWAInstall();

  useEffect(() => {
    if (isInstalled || !canInstall) return;

    const lastPromptTime = localStorage.getItem('pwaPromptTime');
    const daysSinceLastPrompt = lastPromptTime
      ? (Date.now() - parseInt(lastPromptTime)) / (1000 * 60 * 60 * 24)
      : 999;

    if (daysSinceLastPrompt > 7) {
      const timer = setTimeout(() => setShowPrompt(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [canInstall, isInstalled]);

  const handleInstall = async () => {
    const accepted = await install();
    if (accepted) setShowPrompt(false);
    localStorage.setItem('pwaPromptTime', Date.now().toString());
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwaPromptTime', Date.now().toString());
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998] pwa-prompt-backdrop"
        onClick={handleDismiss}
      />

      {/* Install Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] pwa-prompt-sheet">
        <div className="bg-white rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.15)] overflow-hidden max-w-lg mx-auto">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          <div className="px-6 pb-8">
            {/* App icon and info */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg flex-shrink-0 bg-blue-50 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Discount Discovery Zone"
                  className="w-14 h-14 object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-lg truncate">Discount Discovery Zone</h3>
                <p className="text-sm text-gray-500">discount-discovery-zone.vercel.app</p>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <i key={star} className="ri-star-fill text-amber-400 text-xs" />
                  ))}
                  <span className="text-xs text-gray-400 ml-1">Shopping</span>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { icon: 'ri-flashlight-line', label: 'Lightning Fast' },
                { icon: 'ri-wifi-off-line', label: 'Works Offline' },
                { icon: 'ri-notification-3-line', label: 'Get Notified' },
              ].map((feature) => (
                <div
                  key={feature.label}
                  className="bg-gray-50 rounded-xl p-3 text-center"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <i className={`${feature.icon} text-blue-700 text-lg`} />
                  </div>
                  <span className="text-xs font-medium text-gray-600">{feature.label}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={handleInstall}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white py-4 px-6 rounded-2xl font-semibold text-base transition-all active:scale-[0.98] shadow-lg shadow-blue-700/20 flex items-center justify-center gap-2"
            >
              <i className="ri-download-2-line text-xl" />
              Add to Home Screen
            </button>

            <button
              onClick={handleDismiss}
              className="w-full mt-3 py-3 text-gray-500 font-medium text-sm hover:text-gray-700 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
