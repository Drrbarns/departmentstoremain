'use client';

import { useState, useEffect } from 'react';
import { getOptimizedImageUrl } from '@/lib/imageOptimization';

interface ImageZoomProps {
  images: string[];
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
}

export default function ImageZoom({ images, isOpen, onClose, initialIndex = 0 }: ImageZoomProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.5, 1));
    if (scale <= 1.5) {
      setPosition({ x: 0, y: 0 });
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-4 z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <i className="ri-close-line text-2xl"></i>
          </button>
          <span className="text-white text-sm font-medium">
            {currentIndex + 1} / {images.length}
          </span>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={getOptimizedImageUrl(images[currentIndex], { width: 1200 })}
            alt={`Product ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`
            }}
          />
        </div>

        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 rounded-full transition-colors"
            >
              <i className="ri-arrow-left-s-line text-2xl"></i>
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 rounded-full transition-colors"
            >
              <i className="ri-arrow-right-s-line text-2xl"></i>
            </button>
          </>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-6 z-10">
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 1}
            className="w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-subtract-line text-xl"></i>
          </button>
          <div className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full whitespace-nowrap">
            {Math.round(scale * 100)}%
          </div>
          <button
            onClick={handleZoomIn}
            disabled={scale >= 3}
            className="w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-add-line text-xl"></i>
          </button>
        </div>

        {images.length > 1 && (
          <div className="flex items-center justify-center space-x-2 mt-4">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setScale(1);
                  setPosition({ x: 0, y: 0 });
                }}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentIndex
                    ? 'w-8 bg-white'
                    : 'w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
