const KEY = 'ddz_shop_listing_return';

/** Only same-origin shop paths (prevents sessionStorage open-redirect). */
function isSafeShopPath(path: string): boolean {
  return path === '/shop' || (path.startsWith('/shop?') && !path.includes('//'));
}

export function rememberShopListingPath(pathWithQuery: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (isSafeShopPath(pathWithQuery)) {
      sessionStorage.setItem(KEY, pathWithQuery);
    }
  } catch {
    /* quota / private mode */
  }
}

export function getShopListingReturnHref(): string {
  if (typeof window === 'undefined') return '/shop';
  try {
    const v = sessionStorage.getItem(KEY);
    if (v && isSafeShopPath(v)) return v;
  } catch {
    /* */
  }
  return '/shop';
}
