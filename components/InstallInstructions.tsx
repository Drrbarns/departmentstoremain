'use client';

import { useState, useEffect } from 'react';

export default function InstallInstructions() {
  const [device, setDevice] = useState<'ios' | 'android' | 'desktop' | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (isStandalone) {
      return;
    }

    if (/iphone|ipad|ipod/.test(userAgent)) {
      setDevice('ios');
    } else if (/android/.test(userAgent)) {
      setDevice('android');
    } else {
      setDevice('desktop');
    }
  }, []);

  const getInstructions = () => {
    switch (device) {
      case 'ios':
        return {
          title: 'Install on iPhone/iPad',
          steps: [
            { icon: 'ri-safari-line', text: 'Open this page in Safari browser' },
            { icon: 'ri-share-line', text: 'Tap the Share button at the bottom' },
            { icon: 'ri-add-box-line', text: 'Scroll down and tap "Add to Home Screen"' },
            { icon: 'ri-check-line', text: 'Tap "Add" in the top right corner' }
          ]
        };
      case 'android':
        return {
          title: 'Install on Android',
          steps: [
            { icon: 'ri-chrome-line', text: 'Open this page in Chrome browser' },
            { icon: 'ri-more-2-line', text: 'Tap the three dots menu (⋮)' },
            { icon: 'ri-add-box-line', text: 'Select "Add to Home screen"' },
            { icon: 'ri-check-line', text: 'Tap "Add" to confirm' }
          ]
        };
      case 'desktop':
        return {
          title: 'Install on Desktop',
          steps: [
            { icon: 'ri-chrome-line', text: 'Open in Chrome, Edge, or Brave browser' },
            { icon: 'ri-download-line', text: 'Look for install icon in address bar' },
            { icon: 'ri-computer-line', text: 'Click "Install" in the popup' },
            { icon: 'ri-check-line', text: 'App will open in new window' }
          ]
        };
      default:
        return null;
    }
  };

  const instructions = getInstructions();

  if (!instructions) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors whitespace-nowrap"
      >
        <i className="ri-information-line"></i>
        <span className="font-medium">How to Install</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{instructions.title}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {instructions.steps.map((step, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className={`${step.icon} text-emerald-700`}></i>
                  </div>
                  <div className="flex-1 pt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 bg-emerald-700 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="font-medium text-gray-900">{step.text}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-lightbulb-line text-green-700"></i>
                <span className="font-semibold text-green-900">Why Install?</span>
              </div>
              <ul className="space-y-1 text-sm text-green-800">
                <li className="flex items-center gap-2">
                  <i className="ri-check-line"></i>
                  <span>Lightning fast performance</span>
                </li>
                <li className="flex items-center gap-2">
                  <i className="ri-check-line"></i>
                  <span>Works offline</span>
                </li>
                <li className="flex items-center gap-2">
                  <i className="ri-check-line"></i>
                  <span>Push notifications for deals</span>
                </li>
                <li className="flex items-center gap-2">
                  <i className="ri-check-line"></i>
                  <span>One-tap access from home screen</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              Got It!
            </button>
          </div>
        </div>
      )}
    </>
  );
}