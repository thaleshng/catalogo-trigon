import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Eye } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  collectionName?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  collectionName,
}) => {
  const isAvailable = product.stockQuantity > 0;
  const initialImage = product.images[0] || 'https://images.unsplash.com/photo-1613770742268-3693246eb77a?q=80&w=600&auto=format&fit=crop';
  const [imageSrc, setImageSrc] = useState(initialImage);

  return (
    <Link
      to={`/produtos/${product.slug}`}
      className="group relative flex flex-col h-full overflow-hidden rounded-2xl bg-trigon-900 border border-trigon-800 hover:border-crimson-600/50 shadow-md hover:shadow-glow-crimson transition-all duration-300 transform hover:-translate-y-1.5 holo-card"
    >
      {/* Product Image Box */}
      <div className="relative aspect-square w-full overflow-hidden bg-trigon-950 flex items-center justify-center p-3">
        <img
          src={imageSrc}
          onError={() => setImageSrc('/images/trigon-hero-bg.jpg')}
          alt={product.name}
          className={`h-full w-full object-contain object-center transform group-hover:scale-105 transition-transform duration-500 ease-out ${
            !isAvailable ? 'grayscale-[35%] opacity-75' : ''
          }`}
          loading="lazy"
        />

        {/* Clean, Non-colliding Availability Badge */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          {isAvailable ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-950/85 border border-emerald-500/40 text-emerald-300 backdrop-blur-md shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Disponível
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-crimson-950/85 border border-crimson-600/50 text-crimson-300 backdrop-blur-md shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-crimson-500" />
              Esgotado
            </span>
          )}
        </div>

        {/* Quick view overlay hint */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-trigon-900/90 text-white text-xs font-semibold border border-crimson-500/40 shadow-lg">
            <Eye className="w-3.5 h-3.5 text-crimson-400" />
            Ver Detalhes
          </span>
        </div>
      </div>

      {/* Info Container */}
      <div className="flex flex-col flex-1 p-4 sm:p-5 justify-between bg-gradient-to-b from-trigon-900 to-trigon-850 border-t border-trigon-800/60">
        <div>
          {/* Metadata Row: Collection & Rarity Tag (never overlapping) */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {collectionName && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-crimson-400">
                {collectionName}
              </span>
            )}
            {product.rarity && (
              <>
                {collectionName && <span className="text-trigon-700 text-xs">•</span>}
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-trigon-950 border border-trigon-750 text-trigon-300 truncate max-w-[140px]">
                  {product.rarity}
                </span>
              </>
            )}
          </div>

          <div className="h-10 sm:h-11 flex items-start">
            <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-crimson-400 transition-colors line-clamp-2 leading-snug">
              {product.name}
            </h3>
          </div>
        </div>

        {/* Price & Action */}
        <div className="mt-4 pt-3 border-t border-trigon-800/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase text-trigon-400 block font-medium">Preço</span>
            <span className="text-base sm:text-lg font-bold text-white tracking-tight">
              {formatCurrency(product.price)}
            </span>
          </div>

          <div className="text-xs font-medium text-crimson-400 group-hover:underline flex items-center gap-1">
            <span>Detalhes</span>
          </div>
        </div>
      </div>
    </Link>
  );
};
