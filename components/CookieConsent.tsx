'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [preferences, setPreferences] = useState({
    necessary: true,
    analytics: false,
    marketing: false,
    functional: false
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setTimeout(() => setShowBanner(true), 1000);
    }
  }, []);

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookieConsent', JSON.stringify(allAccepted));
    setShowBanner(false);
  };

  const rejectAll = () => {
    const rejected = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookieConsent', JSON.stringify(rejected));
    setShowBanner(false);
  };

  const savePreferences = () => {
    const saved = {
      ...preferences,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookieConsent', JSON.stringify(saved));
    setShowBanner(false);
    setShowPreferences(false);
  };

  if (!showBanner) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]" onClick={() => !showPreferences && rejectAll()} />
      
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-emerald-700 shadow-2xl z-[9999] animate-slide-up">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {!showPreferences ? (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start space-x-4 flex-1">
                <div className="w-12 h-12 flex items-center justify-center bg-emerald-100 rounded-lg flex-shrink-0">
                  <i className="ri-cookie-line text-2xl text-emerald-700"></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">We Value Your Privacy</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
                    By clicking "Accept All", you consent to our use of cookies. 
                    <Link href="/privacy" className="text-emerald-700 hover:text-emerald-900 font-medium ml-1 whitespace-nowrap">
                      Read our Privacy Policy
                    </Link>
                  </p>
                  <label className="flex items-start space-x-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="w-4 h-4 mt-0.5 text-emerald-700 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs text-gray-600 group-hover:text-gray-900">
                      I agree to the{' '}
                      <Link href="/terms" className="text-emerald-700 hover:text-emerald-900 font-medium">
                        Terms & Conditions
                      </Link>
                      {' '}and{' '}
                      <Link href="/privacy" className="text-emerald-700 hover:text-emerald-900 font-medium">
                        Privacy Policy
                      </Link>
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <button
                  onClick={() => setShowPreferences(true)}
                  className="px-6 py-3 border-2 border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-semibold transition-colors whitespace-nowrap"
                >
                  Customize
                </button>
                <button
                  onClick={rejectAll}
                  className="px-6 py-3 border-2 border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-semibold transition-colors whitespace-nowrap"
                >
                  Reject All
                </button>
                <button
                  onClick={acceptAll}
                  disabled={!acceptedTerms}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                    acceptedTerms
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  title={!acceptedTerms ? 'Please accept Terms & Conditions first' : ''}
                >
                  Accept All
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Cookie Preferences</h3>
                <button
                  onClick={() => setShowPreferences(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-semibold text-gray-900">Necessary Cookies</h4>
                      <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full whitespace-nowrap">Always Active</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Essential for the website to function properly. These cookies enable basic features like page navigation and secure access.
                    </p>
                  </div>
                  <div className="w-12 h-6 bg-gray-300 rounded-full flex items-center px-1 cursor-not-allowed">
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm ml-auto"></div>
                  </div>
                </div>

                <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1 pr-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Analytics Cookies</h4>
                    <p className="text-sm text-gray-600">
                      Help us understand how visitors interact with our website by collecting and reporting information anonymously.
                    </p>
                  </div>
                  <button
                    onClick={() => setPreferences({ ...preferences, analytics: !preferences.analytics })}
                    className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors cursor-pointer ${
                      preferences.analytics ? 'bg-emerald-700' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      preferences.analytics ? 'translate-x-6' : 'translate-x-0'
                    }`}></div>
                  </button>
                </div>

                <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1 pr-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Marketing Cookies</h4>
                    <p className="text-sm text-gray-600">
                      Used to track visitors across websites to display relevant ads and measure campaign effectiveness.
                    </p>
                  </div>
                  <button
                    onClick={() => setPreferences({ ...preferences, marketing: !preferences.marketing })}
                    className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors cursor-pointer ${
                      preferences.marketing ? 'bg-emerald-700' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      preferences.marketing ? 'translate-x-6' : 'translate-x-0'
                    }`}></div>
                  </button>
                </div>

                <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1 pr-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Functional Cookies</h4>
                    <p className="text-sm text-gray-600">
                      Enable personalized features like language preferences, wishlists, and recently viewed products.
                    </p>
                  </div>
                  <button
                    onClick={() => setPreferences({ ...preferences, functional: !preferences.functional })}
                    className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors cursor-pointer ${
                      preferences.functional ? 'bg-emerald-700' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      preferences.functional ? 'translate-x-6' : 'translate-x-0'
                    }`}></div>
                  </button>
                </div>
              </div>

              <label className="flex items-start space-x-2 cursor-pointer group mb-4">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-emerald-700 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-sm text-gray-600 group-hover:text-gray-900">
                  I agree to the{' '}
                  <Link href="/terms" className="text-emerald-700 hover:text-emerald-900 font-medium">
                    Terms & Conditions
                  </Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="text-emerald-700 hover:text-emerald-900 font-medium">
                    Privacy Policy
                  </Link>
                </span>
              </label>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={rejectAll}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-semibold transition-colors whitespace-nowrap"
                >
                  Reject All
                </button>
                <button
                  onClick={savePreferences}
                  disabled={!acceptedTerms}
                  className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                    acceptedTerms
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Save Preferences
                </button>
                <button
                  onClick={acceptAll}
                  disabled={!acceptedTerms}
                  className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                    acceptedTerms
                      ? 'bg-gray-900 hover:bg-emerald-700 text-white cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Accept All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
