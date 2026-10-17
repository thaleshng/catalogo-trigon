import React from 'react';
import { Link } from 'react-router-dom';
import { Category } from '../../types';
import { Boxes, ArrowRight } from 'lucide-react';

interface CategoryCardProps {
  category: Category;
  productCount: number;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  productCount,
}) => {
  return (
    <Link
      to={`/linhas/${category.slug}`}
      className="group relative flex flex-col h-full overflow-hidden rounded-2xl bg-trigon-900 border border-trigon-800 hover:border-crimson-600/50 shadow-lg hover:shadow-glow-crimson transition-all duration-300 transform hover:-translate-y-1.5"
    >
      {/* Cover Image Container */}
      <div className="relative h-56 sm:h-64 w-full shrink-0 overflow-hidden bg-trigon-950">
        <img
          src={category.coverImage}
          onError={(e) => {
            e.currentTarget.src =
              'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop';
          }}
          alt={category.name}
          className="h-full w-full object-cover object-center transform group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
        />
        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-trigon-900 via-trigon-900/40 to-transparent" />
        <div className="absolute inset-0 bg-crimson-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Product Count Badge */}
        <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-trigon-950/80 border border-trigon-700/80 text-trigon-200 backdrop-blur-md shadow-md">
          <Boxes className="w-3.5 h-3.5 text-crimson-400" />
          <span>
            {productCount} {productCount === 1 ? 'produto' : 'produtos'}
          </span>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex flex-col flex-1 p-5 sm:p-6 justify-between bg-gradient-to-b from-trigon-900 to-trigon-850">
        <div className="space-y-2">
          {/* Fixed height container for Title */}
          <div className="h-14 sm:h-16 flex items-start">
            <h3 className="font-cinzel text-xl sm:text-2xl font-bold text-white tracking-wide group-hover:text-crimson-400 transition-colors line-clamp-2 leading-snug">
              {category.name}
            </h3>
          </div>
          {/* Fixed height container for Description */}
          <div className="h-10 sm:h-11 overflow-hidden">
            <p className="text-sm text-trigon-300 line-clamp-2 leading-relaxed">
              {category.description || 'Itens selecionados para colecionadores e entusiastas.'}
            </p>
          </div>
        </div>

        {/* Action link */}
        <div className="mt-5 pt-4 border-t border-trigon-800/80 flex items-center justify-between text-sm font-semibold text-crimson-400 group-hover:text-crimson-300">
          <span>Explorar linha</span>
          <div className="w-8 h-8 rounded-full bg-crimson-950/60 border border-crimson-600/30 flex items-center justify-center transform group-hover:translate-x-1 transition-all">
            <ArrowRight className="w-4 h-4 text-crimson-400" />
          </div>
        </div>
      </div>
    </Link>
  );
};
