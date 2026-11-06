import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  children,
  disabled,
  ...rest
}) => {
  const sizeClass = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-xs';
  const variantClass = {
    primary:
      'bg-accent text-white border border-accent hover:not-disabled:bg-accent-hover',
    secondary:
      'bg-sheet text-ink border border-rule-strong hover:not-disabled:bg-paper',
    ghost:
      'bg-transparent text-ink-2 border border-transparent hover:not-disabled:bg-paper hover:not-disabled:text-ink',
    danger:
      'bg-error text-white border border-error hover:not-disabled:opacity-90',
  }[variant];

  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-1.5 font-medium rounded-xs transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClass} ${variantClass} ${className}`}
      {...rest}
    >
      {isLoading && (
        <span
          aria-hidden="true"
          className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"
        />
      )}
      {children}
    </button>
  );
};

