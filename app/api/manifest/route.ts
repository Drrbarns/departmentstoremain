import { NextResponse } from 'next/server';

// Build the PWA manifest from the local /public/icons assets only.
// We intentionally do NOT pull `site_logo` from the database here — that
// previously let an old multimey logo leak into every PWA install.
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512] as const;

export async function GET() {
  const icons = [
    ...ICON_SIZES.map((size) => ({
      src: `/icons/icon-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any' as const,
    })),
    {
      src: '/icons/icon-maskable-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable' as const,
    },
    {
      src: '/icons/icon-maskable-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable' as const,
    },
  ];

  const manifest = {
    name: 'Discount Discovery Zone',
    short_name: 'DDZ',
    description:
      'Shop dresses, electronics, bags and more at Discount Discovery Zone. Quality products delivered across Ghana.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    dir: 'ltr',
    lang: 'en',
    categories: ['shopping', 'lifestyle', 'fashion'],
    icons,
    shortcuts: [
      { name: 'Shop Products', short_name: 'Shop', description: 'Browse all products', url: '/shop?source=pwa-shortcut', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
      { name: 'My Cart', short_name: 'Cart', description: 'View your shopping cart', url: '/cart?source=pwa-shortcut', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
      { name: 'Track Order', short_name: 'Track', description: 'Track your order status', url: '/order-tracking?source=pwa-shortcut', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
      { name: 'My Account', short_name: 'Account', description: 'View your account', url: '/account?source=pwa-shortcut', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
    ],
    screenshots: [],
    prefer_related_applications: false,
    related_applications: [],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      // Force devices to fetch a fresh manifest so PWA installs pick up
      // the bundled DDZ icons immediately.
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
