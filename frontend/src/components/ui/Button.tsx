// Copyright 2026 Swayam Kumar
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'
import { Icon, type IconSize } from './Icon'

export type ButtonVariant =
  | 'primary'
  | 'navy'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'danger-outline'

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: LucideIcon | React.ReactNode
  rightIcon?: LucideIcon | React.ReactNode
  isLoading?: boolean
  loadingText?: string
  fullWidth?: boolean
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover active:bg-accent-active shadow-xs',
  navy:
    'bg-navy-900 text-white border-navy-950 hover:bg-navy-800 active:bg-navy-950 shadow-xs',
  secondary:
    'bg-sheet text-ink border-rule hover:bg-surface-hover hover:border-rule-strong active:bg-subtle',
  ghost:
    'bg-transparent text-ink-2 border-transparent hover:bg-subtle hover:text-ink active:bg-rule-subtle',
  danger:
    'bg-error text-white border-error hover:opacity-95 active:opacity-100 shadow-xs',
  'danger-outline':
    'bg-sheet text-error border-error-border hover:bg-error-bg active:bg-error-tint',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1',
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-body-sm gap-1.5',
  lg: 'h-10 px-5 text-sm gap-2',
}

const ICON_SIZE_FOR_BUTTON: Record<ButtonSize, IconSize> = {
  xs: 'xs',
  sm: 'sm',
  md: 'sm',
  lg: 'md',
}

function renderIconSlot(
  slot: LucideIcon | React.ReactNode | undefined,
  size: IconSize
): React.ReactNode {
  if (!slot) return null
  if (typeof slot === 'function' || (typeof slot === 'object' && 'render' in (slot as object))) {
    return <Icon icon={slot as LucideIcon} size={size} />
  }
  return slot
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      leftIcon,
      rightIcon,
      isLoading = false,
      loadingText,
      fullWidth = false,
      disabled,
      className = '',
      children,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const isDisabled = Boolean(disabled || isLoading)
    const iconSize = ICON_SIZE_FOR_BUTTON[size]

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        className={`inline-flex items-center justify-center font-medium border rounded-sm select-none transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`.trim()}
        {...rest}
      >
        {isLoading ? (
          <Icon icon={Loader2} size={iconSize} className="animate-spin" />
        ) : (
          renderIconSlot(leftIcon, iconSize)
        )}
        <span>{isLoading && loadingText ? loadingText : children}</span>
        {!isLoading && renderIconSlot(rightIcon, iconSize)}
      </button>
    )
  }
)
Button.displayName = 'Button'

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon | React.ReactNode
  'aria-label': string
  variant?: ButtonVariant
  size?: ButtonSize
  isActive?: boolean
  isLoading?: boolean
}

const ICON_BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-6 w-6',
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-9.5 w-9.5',
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = 'secondary',
      size = 'md',
      isActive = false,
      isLoading = false,
      disabled,
      className = '',
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const isDisabled = Boolean(disabled || isLoading)
    const iconSize = ICON_SIZE_FOR_BUTTON[size]
    const activeClasses = isActive
      ? 'bg-accent-tint text-accent border-accent-border font-semibold'
      : VARIANT_CLASSES[variant]

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-pressed={isActive || undefined}
        aria-busy={isLoading || undefined}
        className={`inline-flex items-center justify-center border rounded-sm select-none transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none ${activeClasses} ${ICON_BUTTON_SIZE_CLASSES[size]} ${className}`.trim()}
        {...rest}
      >
        {isLoading ? (
          <Icon icon={Loader2} size={iconSize} className="animate-spin" />
        ) : (
          renderIconSlot(icon, iconSize)
        )}
      </button>
    )
  }
)
IconButton.displayName = 'IconButton'
