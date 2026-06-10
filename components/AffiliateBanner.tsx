'use client';

import { useState } from 'react';
import { useAffiliate } from '@/context/AffiliateContext';

export default function AffiliateBanner() {
  const { isReferred, affiliate } = useAffiliate();
  const [dismissed, setDismissed] = useState(false);

  if (!isReferred || dismissed) return null;

  const who = affiliate?.full_name ? ` by ${affiliate.full_name}` : '';

  return (
    <div className="bg-brand text-white text-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-3 text-center">
        <i className="ri-gift-line shrink-0" />
        <span>You were referred{who}. Prices include a small referral fee that supports them.</span>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="ml-2 opacity-80 hover:opacity-100 shrink-0"
        >
          <i className="ri-close-line" />
        </button>
      </div>
    </div>
  );
}
