import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'whatsapp';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs font-medium rounded-lg gap-1.5',
    md: 'px-4 py-2.5 text-sm font-medium rounded-xl gap-2',
    lg: 'px-6 py-3.5 text-base font-semibold rounded-xl gap-2.5',
  };

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-crimson-700 via-crimson-600 to-crimson-700 hover:from-crimson-600 hover:to-crimson-500 text-white shadow-lg shadow-crimson-900/40 border border-crimson-500/30 hover:border-crimson-400/50 hover:shadow-glow-crimson',
    secondary:
      'bg-trigon-800 hover:bg-trigon-750 text-trigon-100 border border-trigon-700 hover:border-trigon-600 shadow-sm',
    danger:
      'bg-red-950/70 hover:bg-red-900/80 text-red-200 border border-red-700/50 hover:border-red-500',
    ghost:
      'bg-transparent hover:bg-white/5 text-trigon-300 hover:text-white',
    outline:
      'bg-transparent border border-trigon-700 hover:border-crimson-600/60 text-trigon-200 hover:text-white hover:bg-trigon-800/40',
    whatsapp:
      'bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#29e06d] hover:to-[#17a393] text-white font-semibold shadow-lg shadow-emerald-950/50 border border-emerald-400/30',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={`inline-flex items-center justify-center transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none select-none ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
};
