import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ShowcaseSliderProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  prevAriaLabel?: string;
  nextAriaLabel?: string;
}

export function ShowcaseSlider<T>({
  items,
  getKey,
  renderItem,
  prevAriaLabel = 'Item anterior',
  nextAriaLabel = 'Próximo item',
}: ShowcaseSliderProps<T>) {
  const sliderRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      const scrollAmount = 370;
      sliderRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="relative group/carousel">
      {/* Sliding Arrows (aparecem caso haja mais de 3 itens) */}
      {items.length > 3 && (
        <>
          <button
            type="button"
            onClick={() => handleScroll('left')}
            className="hidden md:flex absolute -left-4 lg:-left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-trigon-950/90 border border-trigon-700 hover:border-crimson-500 text-white hover:text-crimson-400 shadow-2xl items-center justify-center transition-all backdrop-blur-md cursor-pointer hover:scale-110"
            aria-label={prevAriaLabel}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll('right')}
            className="hidden md:flex absolute -right-4 lg:-right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-trigon-950/90 border border-trigon-700 hover:border-crimson-500 text-white hover:text-crimson-400 shadow-2xl items-center justify-center transition-all backdrop-blur-md cursor-pointer hover:scale-110"
            aria-label={nextAriaLabel}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Cards Carousel Track: Centralizado quando há 3 ou menos, e slideável quando exceder */}
      <div
        ref={sliderRef}
        className={`flex items-stretch gap-6 sm:gap-8 overflow-x-auto scroll-smooth py-4 px-2 no-scrollbar snap-x snap-mandatory ${
          items.length <= 3 ? 'justify-start lg:justify-center' : 'justify-start'
        }`}
      >
        {items.map((item) => (
          <div
            key={getKey(item)}
            className="w-[285px] sm:w-[325px] md:w-[350px] shrink-0 snap-center flex flex-col h-full"
          >
            {renderItem(item)}
          </div>
        ))}
      </div>

      {/* Mobile / Scroll Indicator helper */}
      {items.length > 3 && (
        <div className="flex md:hidden items-center justify-center gap-3 mt-4 text-xs text-trigon-400">
          <button
            onClick={() => handleScroll('left')}
            className="p-1.5 rounded-lg bg-trigon-900 border border-trigon-800 text-trigon-300"
            aria-label={prevAriaLabel}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Deslize para ver mais</span>
          <button
            onClick={() => handleScroll('right')}
            className="p-1.5 rounded-lg bg-trigon-900 border border-trigon-800 text-trigon-300"
            aria-label={nextAriaLabel}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
