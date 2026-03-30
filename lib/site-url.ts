/**
 * Canonical public URL for links in emails, redirects, and auth callbacks.
 * Avoids falling back to localhost in production when NEXT_PUBLIC_APP_URL is unset.
 */
const PRIMARY_SITE_URL = 'https://www.discountdiscoveryzone.com';

export function getPublicSiteUrl(): string {
    const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (fromEnv) {
        return fromEnv.replace(/\/+$/, '');
    }

    const vercel = process.env.VERCEL_URL?.trim();
    if (vercel) {
        const host = vercel.replace(/^https?:\/\//, '');
        return `https://${host}`.replace(/\/+$/, '');
    }

    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3000';
    }

    return PRIMARY_SITE_URL;
}
