import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav className="flex items-center text-xs sm:text-sm text-trigon-400 py-3 overflow-x-auto whitespace-nowrap scrollbar-none">
      <Link
        to="/"
        className="flex items-center gap-1.5 hover:text-white transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
        <span>Início</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-3.5 h-3.5 mx-2 text-trigon-600 shrink-0" />
            {isLast || !item.href ? (
              <span className="text-crimson-400 font-medium truncate max-w-[200px] sm:max-w-xs">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="hover:text-white transition-colors truncate max-w-[200px] sm:max-w-xs"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
