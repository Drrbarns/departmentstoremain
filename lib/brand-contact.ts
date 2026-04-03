/**
 * Default customer-facing phone and email for Discount Discovery Zone (live: discountdiscoveryzone.com).
 * Admin → Settings / site_settings can override what the storefront displays via CMS.
 * WhatsApp matches product-page customer care (233248615775).
 */
export const PUBLIC_CONTACT_PHONE = '+233248615775';
export const PUBLIC_CONTACT_EMAIL = 'info@discountdiscoveryzone.com';

/** Spaced for display (FAQs, legal copy) */
export const PUBLIC_CONTACT_PHONE_DISPLAY = '+233 24 861 5775';

/** Digits only for wa.me links */
export const PUBLIC_CONTACT_PHONE_WHATSAPP = '233248615775';

export const PUBLIC_SITE_DOMAIN = 'www.discountdiscoveryzone.com';

const LEGACY_PHONE_DIGITS = new Set(['233209597443', '0209597443']);

/**
 * If site_settings still has old placeholder data, show canonical contact info anyway.
 */
export function effectiveContactEmail(stored: string): string {
  const t = (stored || '').trim();
  if (!t) return PUBLIC_CONTACT_EMAIL;
  const lower = t.toLowerCase();
  if (lower.includes('vercel.app')) return PUBLIC_CONTACT_EMAIL;
  if (lower.includes('discount-discovery-zone')) return PUBLIC_CONTACT_EMAIL;
  return t;
}

export function effectiveContactPhone(stored: string): string {
  const t = (stored || '').trim();
  if (!t) return PUBLIC_CONTACT_PHONE;
  const digits = t.replace(/\D/g, '');
  if (LEGACY_PHONE_DIGITS.has(digits) || digits.endsWith('209597443')) {
    return PUBLIC_CONTACT_PHONE;
  }
  return t;
}
