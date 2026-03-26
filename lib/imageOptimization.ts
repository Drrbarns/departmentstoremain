type ImageOptimizationOptions = {
  width?: number;
  quality?: number;
  format?: 'origin' | 'webp' | 'avif';
};

const DEFAULT_OPTIONS: Required<ImageOptimizationOptions> = {
  width: 1200,
  quality: 70,
  format: 'webp',
};

export function getOptimizedImageUrl(
  src: string,
  options: ImageOptimizationOptions = {}
): string {
  if (!src || !/^https?:\/\//i.test(src)) return src;

  try {
    const url = new URL(src);
    const pathname = url.pathname;

    const isSupabasePublicObject =
      url.hostname.endsWith('.supabase.co') &&
      pathname.includes('/storage/v1/object/public/');

    if (!isSupabasePublicObject) return src;

    const { width, quality, format } = { ...DEFAULT_OPTIONS, ...options };
    const renderPath = pathname.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/'
    );

    const optimizedUrl = new URL(`${url.origin}${renderPath}`);
    optimizedUrl.searchParams.set('width', String(width));
    optimizedUrl.searchParams.set('quality', String(quality));

    if (format !== 'origin') {
      optimizedUrl.searchParams.set('format', format);
    }

    return optimizedUrl.toString();
  } catch {
    return src;
  }
}
