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

import React, { useId } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon'

export type InputSize = 'sm' | 'md'

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  /** Optional physical unit badge rendered inside the right edge (e.g., "kVA", "m", "INR") */
  unit?: string
  leftIcon?: LucideIcon
  mono?: boolean
  size?: InputSize
  containerClassName?: string
}

const INPUT_SIZE_CLASSES: Record<InputSize, string> = {
  sm: 'h-8 text-xs px-2.5',
  md: 'h-9 text-body-sm px-3',
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      label,
      hint,
      error,
      unit,
      leftIcon,
      mono = false,
      size = 'md',
      disabled,
      className = '',
      containerClassName = '',
      ...rest
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const hintId = hint ? `${inputId}-hint` : undefined
    const errorId = error ? `${inputId}-error` : undefined
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

    const borderClass = error
      ? 'border-error focus-visible:ring-error focus-visible:border-error'
      : 'border-rule hover:border-rule-strong focus-visible:ring-focus focus-visible:border-accent'

    return (
      <div className={`flex flex-col ${containerClassName}`.trim()}>
        {label && (
          <label htmlFor={inputId} className="field-label">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-2.5 text-ink-3 flex items-center">
              <Icon icon={leftIcon} size="sm" />
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`w-full rounded-sm border bg-sheet text-ink placeholder:text-ink-3 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 disabled:bg-subtle disabled:text-ink-3 disabled:cursor-not-allowed ${INPUT_SIZE_CLASSES[size]} ${borderClass} ${leftIcon ? 'pl-8' : ''} ${unit ? 'pr-12' : ''} ${mono ? 'font-mono tabular-nums' : 'font-sans'} ${className}`.trim()}
            {...rest}
          />
          {unit && (
            <span
              className="pointer-events-none absolute right-2 text-2xs font-mono uppercase tracking-wider text-ink-3 bg-subtle px-1.5 py-0.5 rounded-xs border border-rule-subtle"
              aria-hidden="true"
            >
              {unit}
            </span>
          )}
        </div>
        {error ? (
          <p id={errorId} role="alert" className="field-error">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="field-hint">
            {hint}
          </p>
        ) : null}
      </div>
    )
  }
)
Input.displayName = 'Input'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  mono?: boolean
  containerClassName?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      id,
      label,
      hint,
      error,
      mono = false,
      disabled,
      className = '',
      containerClassName = '',
      rows = 3,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId()
    const textareaId = id ?? generatedId
    const hintId = hint ? `${textareaId}-hint` : undefined
    const errorId = error ? `${textareaId}-error` : undefined
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

    const borderClass = error
      ? 'border-error focus-visible:ring-error focus-visible:border-error'
      : 'border-rule hover:border-rule-strong focus-visible:ring-focus focus-visible:border-accent'

    return (
      <div className={`flex flex-col ${containerClassName}`.trim()}>
        {label && (
          <label htmlFor={textareaId} className="field-label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full rounded-sm border bg-sheet px-3 py-2 text-body-sm text-ink placeholder:text-ink-3 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 disabled:bg-subtle disabled:text-ink-3 disabled:cursor-not-allowed ${borderClass} ${mono ? 'font-mono text-xs' : 'font-sans'} ${className}`.trim()}
          {...rest}
        />
        {error ? (
          <p id={errorId} role="alert" className="field-error">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="field-hint">
            {hint}
          </p>
        ) : null}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode
  description?: string
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ id, label, description, disabled, className = '', ...rest }, ref) => {
    const generatedId = useId()
    const checkboxId = id ?? generatedId
    const descId = description ? `${checkboxId}-desc` : undefined

    return (
      <label
        htmlFor={checkboxId}
        className={`inline-flex items-start gap-2 select-none ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${className}`.trim()}
      >
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          disabled={disabled}
          aria-describedby={descId}
          className="mt-0.5 h-3.5 w-3.5 rounded-xs border-rule text-accent focus:ring-2 focus:ring-focus"
          {...rest}
        />
        <span className="flex flex-col">
          <span className="text-xs font-medium text-ink leading-tight">{label}</span>
          {description && (
            <span id={descId} className="text-2xs text-ink-3 mt-0.5">
              {description}
            </span>
          )}
        </span>
      </label>
    )
  }
)
Checkbox.displayName = 'Checkbox'

