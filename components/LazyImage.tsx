'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  onLoad?: () => void;
  sizes?: string;
}

export default function LazyImage({
  src,
  alt,
  className = '',
  width,
  height,
  priority = false,
  onLoad,
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const normalizedSrc = typeof src === 'string' ? src.trim() : '';
  const isRemoteImage = /^https?:\/\//i.test(normalizedSrc);
  const safeSrc = (() => {
    if (!normalizedSrc) return '';
    if (!isRemoteImage) return normalizedSrc;
    try {
      return new URL(normalizedSrc).toString();
    } catch {
      return normalizedSrc;
    }
  })();

  useEffect(() => {
    // Reset loading/error state when image source changes.
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onLoad?.();
  };

  // Fallback for invalid/empty URLs
  if (!safeSrc || hasError) {
    return (
      <div className={`relative overflow-hidden bg-gray-200 flex items-center justify-center ${className}`} style={{ width, height }}>
        <span className="text-gray-400 text-xs">No Image</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse z-10"></div>
      )}
      {isRemoteImage ? (
        <img
          src={safeSrc}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <Image
          src={safeSrc}
          alt={alt}
          fill
          sizes={sizes}
          className={`object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleLoad}
          onError={handleError}
          priority={priority}
          quality={75}
        />
      )}
    </div>
  );
}
