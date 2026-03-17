import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ icon: string }> }
) {
  const { icon } = await params;

  // Only allow icon-*.png to prevent path traversal
  if (!/^icon-\d+x\d+\.png$/.test(icon) && !/^icon-maskable-\d+x\d+\.png$/.test(icon)) {
    return new NextResponse('Not Found', { status: 404 });
  }

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

  if (siteLogo) {
    return NextResponse.redirect(siteLogo, 302);
  }

  const filePath = path.join(process.cwd(), 'public', 'icons', icon);
  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'image/png' },
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
