import React, { useState, useEffect } from 'react';
import { formatTcgdexImageUrl } from '../../../services/tcgdexService';
import { Sparkles } from 'lucide-react';

interface CardThumbnailProps {
  image?: string | null;
  fallbackImage?: string | null;
  alt: string;
  quality?: 'low' | 'high';
  size?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
  onClick?: () => void;
}

export const CardThumbnail: React.FC<CardThumbnailProps> = ({
  image,
  fallbackImage,
  alt,
  quality = 'low',
  size = 'sm',
  className = '',
  onClick,
}) => {
  const primaryUrl = formatTcgdexImageUrl(image, quality);
  const fallbackUrl = formatTcgdexImageUrl(fallbackImage, quality);

  const [currentSrc, setCurrentSrc] = useState<string | null>(primaryUrl || fallbackUrl || null);
  const [triedFallback, setTriedFallback] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentSrc(primaryUrl || fallbackUrl || null);
    setTriedFallback(false);
    setHasError(false);
  }, [primaryUrl, fallbackUrl]);

  const sizeClasses = {
    sm: 'w-11 h-16 rounded-lg',
    md: 'w-16 h-22 rounded-xl',
    lg: 'w-48 sm:w-60 aspect-[63/88] rounded-2xl',
    full: 'w-full aspect-[63/88] rounded-2xl',
  };

  const handleImageError = () => {
    if (currentSrc) {
      // 1. Se falhou low.webp no CDN da TCGdex (ex: sv08.5-012), tenta high.webp
      if (currentSrc.endsWith('/low.webp')) {
        setCurrentSrc(currentSrc.replace(/\/low\.webp$/, '/high.webp'));
        return;
      }
      // 2. Se falhou high.webp, tenta low.png
      if (currentSrc.endsWith('/high.webp')) {
        setCurrentSrc(currentSrc.replace(/\/high\.webp$/, '/low.png'));
        return;
      }
      // 3. Se falhou low.png, tenta high.png
      if (currentSrc.endsWith('/low.png')) {
        setCurrentSrc(currentSrc.replace(/\/low\.png$/, '/high.png'));
        return;
      }
    }

    if (!triedFallback && fallbackUrl && fallbackUrl !== currentSrc) {
      setTriedFallback(true);
      setCurrentSrc(fallbackUrl);
      return;
    }

    setHasError(true);
  };

  if (!currentSrc || hasError) {
    return (
      <div
        onClick={onClick}
        className={`${sizeClasses[size]} bg-gradient-to-br from-trigon-950 via-trigon-900 to-crimson-950/50 border border-trigon-750 flex flex-col items-center justify-center p-1.5 text-center select-none shrink-0 ${
          onClick ? 'cursor-pointer hover:border-crimson-500/60' : ''
        } ${className}`}
        title={`${alt} (Imagem indisponível)`}
      >
        <Sparkles className="w-4 h-4 text-crimson-500/70 mb-0.5 shrink-0" />
        <span className="font-cinzel text-[8px] font-bold tracking-widest text-trigon-400 uppercase leading-tight line-clamp-2">
          TRIGON TCG
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`${sizeClasses[size]} bg-trigon-950 border border-trigon-800 overflow-hidden flex items-center justify-center shrink-0 p-0.5 transition-all ${
        onClick ? 'cursor-pointer hover:border-crimson-500/70 hover:shadow-glow-crimson' : ''
      } ${className}`}
    >
      <img
        src={currentSrc}
        alt={alt}
        loading="lazy"
        onError={handleImageError}
        className="w-full h-full object-contain rounded-[inherit]"
      />
    </div>
  );
};

