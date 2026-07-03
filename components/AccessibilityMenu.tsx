'use client';

import { useState, useEffect } from 'react';

export default function AccessibilityMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState({
    fontSize: 'normal',
    contrast: 'normal',
    lineHeight: 'normal',
    letterSpacing: 'normal',
    cursorSize: 'normal',
    readableFont: false,
    hideImages: false,
    highlightLinks: false
  });

  useEffect(() => {
    const saved = localStorage.getItem('accessibilitySettings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('accessibilitySettings', JSON.stringify(settings));
    applySettings();
  }, [settings]);

  const applySettings = () => {
    const root = document.documentElement;

    root.classList.remove('text-sm', 'text-base', 'text-lg', 'text-xl');
    root.classList.remove('contrast-normal', 'contrast-high');
    root.classList.remove('leading-normal', 'leading-relaxed', 'leading-loose');
    root.classList.remove('tracking-normal', 'tracking-wide', 'tracking-wider');

    if (settings.fontSize === 'large') root.classList.add('text-lg');
    if (settings.fontSize === 'xlarge') root.classList.add('text-xl');
    if (settings.contrast === 'high') root.classList.add('contrast-high');
    if (settings.lineHeight === 'relaxed') root.classList.add('leading-relaxed');
    if (settings.lineHeight === 'loose') root.classList.add('leading-loose');
    if (settings.letterSpacing === 'wide') root.classList.add('tracking-wide');
    if (settings.letterSpacing === 'wider') root.classList.add('tracking-wider');

    if (settings.readableFont) {
      root.style.fontFamily = 'Arial, sans-serif';
    } else {
      root.style.fontFamily = '';
    }

    if (settings.cursorSize === 'large') {
      root.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'black\' stroke=\'white\' stroke-width=\'1\' d=\'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z\'/%3E%3C/svg%3E") 16 16, auto';
    } else {
      root.style.cursor = '';
    }

    if (settings.hideImages) {
      document.body.classList.add('hide-images');
    } else {
      document.body.classList.remove('hide-images');
    }

    if (settings.highlightLinks) {
      document.body.classList.add('highlight-links');
    } else {
      document.body.classList.remove('highlight-links');
    }
  };

  const resetSettings = () => {
    setSettings({
      fontSize: 'normal',
      contrast: 'normal',
      lineHeight: 'normal',
      letterSpacing: 'normal',
      cursorSize: 'normal',
      readableFont: false,
      hideImages: false,
      highlightLinks: false
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-0 top-1/2 -translate-y-1/2 bg-emerald-700 hover:bg-emerald-800 text-white p-3 rounded-r-lg shadow-lg z-[9997] transition-all"
        aria-label="Accessibility Menu"
      >
        <i className="ri-accessibility-line text-2xl"></i>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]" onClick={() => setIsOpen(false)} />
          
          <div className="fixed left-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[9999] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 flex items-center justify-center bg-emerald-100 rounded-lg">
                  <i className="ri-accessibility-line text-xl text-emerald-700"></i>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Accessibility</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Text Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {['normal', 'large', 'xlarge'].map((size) => (
                    <button
                      key={size}
                      onClick={() => setSettings({ ...settings, fontSize: size })}
                      className={`py-2 px-4 rounded-lg border-2 font-medium transition-colors whitespace-nowrap ${
                        settings.fontSize === size
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {size === 'normal' ? 'A' : size === 'large' ? 'A+' : 'A++'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Contrast</label>
                <div className="grid grid-cols-2 gap-2">
                  {['normal', 'high'].map((contrast) => (
                    <button
                      key={contrast}
                      onClick={() => setSettings({ ...settings, contrast })}
                      className={`py-2 px-4 rounded-lg border-2 font-medium transition-colors whitespace-nowrap ${
                        settings.contrast === contrast
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {contrast === 'normal' ? 'Normal' : 'High'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Line Height</label>
                <div className="grid grid-cols-3 gap-2">
                  {['normal', 'relaxed', 'loose'].map((height) => (
                    <button
                      key={height}
                      onClick={() => setSettings({ ...settings, lineHeight: height })}
                      className={`py-2 px-4 rounded-lg border-2 font-medium transition-colors whitespace-nowrap capitalize ${
                        settings.lineHeight === height
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {height}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Letter Spacing</label>
                <div className="grid grid-cols-3 gap-2">
                  {['normal', 'wide', 'wider'].map((spacing) => (
                    <button
                      key={spacing}
                      onClick={() => setSettings({ ...settings, letterSpacing: spacing })}
                      className={`py-2 px-4 rounded-lg border-2 font-medium transition-colors whitespace-nowrap capitalize ${
                        settings.letterSpacing === spacing
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {spacing}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Cursor Size</label>
                <div className="grid grid-cols-2 gap-2">
                  {['normal', 'large'].map((size) => (
                    <button
                      key={size}
                      onClick={() => setSettings({ ...settings, cursorSize: size })}
                      className={`py-2 px-4 rounded-lg border-2 font-medium transition-colors whitespace-nowrap capitalize ${
                        settings.cursorSize === size
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-semibold text-gray-900">Readable Font</span>
                  <button
                    onClick={() => setSettings({ ...settings, readableFont: !settings.readableFont })}
                    className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${
                      settings.readableFont ? 'bg-emerald-700' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      settings.readableFont ? 'translate-x-6' : 'translate-x-0'
                    }`}></div>
                  </button>
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-semibold text-gray-900">Hide Images</span>
                  <button
                    onClick={() => setSettings({ ...settings, hideImages: !settings.hideImages })}
                    className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${
                      settings.hideImages ? 'bg-emerald-700' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      settings.hideImages ? 'translate-x-6' : 'translate-x-0'
                    }`}></div>
                  </button>
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-semibold text-gray-900">Highlight Links</span>
                  <button
                    onClick={() => setSettings({ ...settings, highlightLinks: !settings.highlightLinks })}
                    className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${
                      settings.highlightLinks ? 'bg-emerald-700' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      settings.highlightLinks ? 'translate-x-6' : 'translate-x-0'
                    }`}></div>
                  </button>
                </label>
              </div>

              <button
                onClick={resetSettings}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-semibold transition-colors whitespace-nowrap"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        .hide-images img {
          display: none !important;
        }
        .highlight-links a {
          background-color: #fef3c7 !important;
          text-decoration: underline !important;
          font-weight: 600 !important;
        }
        .contrast-high {
          filter: contrast(1.5);
        }
      `}</style>
    </>
  );
}
