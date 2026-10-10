import React, { useState } from 'react';

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  images,
  productName,
}) => {
  const safeImages = images && images.length > 0
    ? images
    : ['https://images.unsplash.com/photo-1613770742268-3693246eb77a?q=80&w=1000&auto=format&fit=crop'];

  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image Display */}
      <div className="relative aspect-square w-full rounded-2xl bg-trigon-950 border border-trigon-800 p-4 sm:p-6 flex items-center justify-center overflow-hidden shadow-2xl group">
        <img
          src={safeImages[activeIndex]}
          onError={(e) => {
            e.currentTarget.src = '/images/trigon-hero-bg.jpg';
          }}
          alt={`${productName} - Imagem ${activeIndex + 1}`}
          className="max-h-full max-w-full object-contain transform group-hover:scale-105 transition-transform duration-300"
        />

        {/* Subtle corner badge with image counter */}
        {safeImages.length > 1 && (
          <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 border border-trigon-700 text-xs text-trigon-300 backdrop-blur-md">
            {activeIndex + 1} / {safeImages.length}
          </div>
        )}
      </div>

      {/* Thumbnails Row */}
      {safeImages.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
          {safeImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 bg-trigon-950 transition-all p-1 ${
                activeIndex === idx
                  ? 'border-crimson-500 shadow-glow-crimson'
                  : 'border-trigon-800 hover:border-trigon-700 opacity-60 hover:opacity-100'
              }`}
              aria-label={`Ver imagem ${idx + 1}`}
            >
              <img
                src={img}
                alt={`Miniatura ${idx + 1}`}
                className="w-full h-full object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
