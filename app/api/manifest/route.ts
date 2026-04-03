import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512] as const;

export async function GET() {
  let siteLogo = '';

  try {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'site_logo')
      .maybeSingle();

    if (data?.value != null) {
      siteLogo = typeof data.value === 'string' ? data.value : String(data.value);
    }
  } catch {
    // ignore
  }

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.discountdiscoveryzone.com').replace(/\/$/, '');
  const iconBase = siteLogo || `${baseUrl}/icons/icon-192x192.png`;

  const icons = [
    ...ICON_SIZES.map((size) => ({
      src: iconBase,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any' as const,
    })),
    { src: iconBase, sizes: '192x192', type: 'image/png', purpose: 'maskable' as const },
    { src: iconBase, sizes: '512x512', type: 'image/png', purpose: 'maskable' as const },
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
      { name: 'Shop Products', short_name: 'Shop', description: 'Browse all products', url: '/shop?source=pwa-shortcut', icons: [{ src: iconBase, sizes: '96x96' }] },
      { name: 'My Cart', short_name: 'Cart', description: 'View your shopping cart', url: '/cart?source=pwa-shortcut', icons: [{ src: iconBase, sizes: '96x96' }] },
      { name: 'Track Order', short_name: 'Track', description: 'Track your order status', url: '/order-tracking?source=pwa-shortcut', icons: [{ src: iconBase, sizes: '96x96' }] },
      { name: 'My Account', short_name: 'Account', description: 'View your account', url: '/account?source=pwa-shortcut', icons: [{ src: iconBase, sizes: '96x96' }] },
    ],
    screenshots: [],
    prefer_related_applications: false,
    related_applications: [],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
