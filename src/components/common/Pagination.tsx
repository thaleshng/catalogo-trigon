import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  itemsPerPageOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50, 100],
  itemLabel = 'itens',
  className = '',
}) => {
  if (totalItems <= 0) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Gera a lista de números das páginas com reticências inteligentes
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-trigon-950/80 border-t border-trigon-800 text-xs text-trigon-400 select-none ${className}`}
    >
      {/* Texto Informativo e Seletor de Itens por Página */}
      <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
        <span>
          Exibindo <strong className="text-white font-mono">{startItem}</strong>–
          <strong className="text-white font-mono">{endItem}</strong> de{' '}
          <strong className="text-white font-mono">{totalItems}</strong> {itemLabel}
        </span>

        {onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-trigon-800">
            <span className="text-[11px] text-trigon-400">Por pág:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="px-2 py-1 rounded-lg bg-trigon-900 border border-trigon-750 text-white text-xs font-mono focus:outline-none focus:border-crimson-500 cursor-pointer"
            >
              {itemsPerPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Botões de Navegação */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 flex-wrap justify-center">
          {/* Primeira Página */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            title="Primeira Página"
            className="p-1.5 rounded-lg bg-trigon-900 hover:bg-trigon-850 disabled:opacity-40 disabled:cursor-not-allowed border border-trigon-800 text-trigon-300 hover:text-white transition-colors"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Página Anterior */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title="Página Anterior"
            className="p-1.5 rounded-lg bg-trigon-900 hover:bg-trigon-850 disabled:opacity-40 disabled:cursor-not-allowed border border-trigon-800 text-trigon-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Números das Páginas */}
          <div className="flex items-center gap-1 mx-1">
            {pages.map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-1 text-trigon-500 font-mono text-xs select-none"
                  >
                    …
                  </span>
                );
              }

              const pageNum = p as number;
              const isActive = pageNum === currentPage;

              return (
                <button
                  key={`page-${pageNum}`}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={`min-w-[30px] h-[30px] px-2 rounded-lg font-mono text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-crimson-600 text-white shadow-glow-crimson border border-crimson-500'
                      : 'bg-trigon-900 hover:bg-trigon-850 text-trigon-300 hover:text-white border border-trigon-800'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Próxima Página */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Próxima Página"
            className="p-1.5 rounded-lg bg-trigon-900 hover:bg-trigon-850 disabled:opacity-40 disabled:cursor-not-allowed border border-trigon-800 text-trigon-300 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Última Página */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            title="Última Página"
            className="p-1.5 rounded-lg bg-trigon-900 hover:bg-trigon-850 disabled:opacity-40 disabled:cursor-not-allowed border border-trigon-800 text-trigon-300 hover:text-white transition-colors"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

