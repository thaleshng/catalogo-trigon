import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'crimson';
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
  dot = false,
}) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2.5 py-0.5',
    md: 'text-xs px-3 py-1',
  };

  const variantClasses = {
    success: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300',
    danger: 'bg-crimson-950/75 border-crimson-600/40 text-crimson-200',
    warning: 'bg-amber-950/70 border-amber-500/40 text-amber-300',
    info: 'bg-sky-950/70 border-sky-500/40 text-sky-300',
    neutral: 'bg-trigon-800/80 border-trigon-700 text-trigon-300',
    crimson: 'bg-crimson-950/70 border-crimson-600/40 text-crimson-300',
  };

  const dotColors = {
    success: 'bg-emerald-400',
    danger: 'bg-crimson-500',
    warning: 'bg-amber-400',
    info: 'bg-sky-400',
    neutral: 'bg-trigon-400',
    crimson: 'bg-crimson-500',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border backdrop-blur-sm tracking-wide uppercase whitespace-nowrap ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`}
        />
      )}
      {children}
    </span>
  );
};
