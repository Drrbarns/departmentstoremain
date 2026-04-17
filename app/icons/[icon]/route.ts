import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// Serves the bundled DDZ icons from /public/icons.
// IMPORTANT: This route never redirects to a remote logo. Earlier versions
// pulled `site_settings.site_logo` and 302'd to it, which let an old branding
// URL (multimey) leak into every favicon/PWA icon request and get cached
// aggressively by browsers and the service worker.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ icon: string }> }
) {
  const { icon } = await params;

  if (!/^icon-\d+x\d+\.png$/.test(icon) && !/^icon-maskable-\d+x\d+\.png$/.test(icon)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const filePath = path.join(process.cwd(), 'public', 'icons', icon);
  try {
    const buffer = await readFile(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        // Force every device/proxy to revalidate so any previously cached
        // remote-redirected response is replaced with the bundled icon.
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
