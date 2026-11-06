/*
 * Copyright 2026 Swayam Kumar
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

