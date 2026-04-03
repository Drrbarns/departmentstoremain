'use client';

import { useState, useRef, useEffect } from 'react';

type ProductShareControlsProps = {
  url: string;
  title: string;
};

export default function ProductShareControls({ url, title }: ProductShareControlsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const links = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  const nativeShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) return;
    try {
      await navigator.share({ title, text: title, url });
      setOpen(false);
    } catch {
      /* user cancelled */
    }
  };

  const itemClass =
    'flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 transition-colors text-left';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Share product"
        className="w-12 h-12 flex items-center justify-center border-2 border-gray-200 hover:border-blue-700 rounded-full transition-colors cursor-pointer"
      >
        <i className="ri-share-line text-gray-700 text-xl" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 min-w-[13.5rem] rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button type="button" role="menuitem" className={itemClass} onClick={nativeShare}>
              <i className="ri-share-forward-line text-lg text-blue-700" aria-hidden />
              Share…
            </button>
          )}

          <button type="button" role="menuitem" className={itemClass} onClick={copyLink}>
            <i className={`text-lg ${copied ? 'ri-checkbox-circle-line text-emerald-600' : 'ri-links-line text-gray-600'}`} aria-hidden />
            {copied ? 'Link copied!' : 'Copy link'}
          </button>

          <a
            href={links.facebook}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <i className="ri-facebook-fill text-lg text-[#1877F2]" aria-hidden />
            Facebook
          </a>

          <a
            href={links.twitter}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <i className="ri-twitter-x-fill text-lg text-gray-900" aria-hidden />
            X (Twitter)
          </a>

          <a
            href={links.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <i className="ri-whatsapp-fill text-lg text-[#25D366]" aria-hidden />
            WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
