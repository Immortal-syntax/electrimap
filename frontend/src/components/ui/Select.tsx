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
import { ChevronDown } from 'lucide-react'
import { Icon } from './Icon'

export type SelectSize = 'sm' | 'md'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  options?: SelectOption[]
  mono?: boolean
  size?: SelectSize
  containerClassName?: string
}

const SELECT_SIZE_CLASSES: Record<SelectSize, string> = {
  sm: 'h-8 text-xs pl-2.5 pr-7',
  md: 'h-9 text-body-sm pl-3 pr-8',
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      id,
      label,
      hint,
      error,
      options,
      mono = false,
      size = 'md',
      disabled,
      className = '',
      containerClassName = '',
      children,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId()
    const selectId = id ?? generatedId
    const hintId = hint ? `${selectId}-hint` : undefined
    const errorId = error ? `${selectId}-error` : undefined
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

    const borderClass = error
      ? 'border-error focus-visible:ring-error focus-visible:border-error'
      : 'border-rule hover:border-rule-strong focus-visible:ring-focus focus-visible:border-accent'

    return (
      <div className={`flex flex-col ${containerClassName}`.trim()}>
        {label && (
          <label htmlFor={selectId} className="field-label">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`w-full appearance-none rounded-sm border bg-sheet text-ink transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 disabled:bg-subtle disabled:text-ink-3 disabled:cursor-not-allowed ${SELECT_SIZE_CLASSES[size]} ${borderClass} ${mono ? 'font-mono tabular-nums' : 'font-sans'} ${className}`.trim()}
            {...rest}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <span
            className="pointer-events-none absolute right-2.5 text-ink-3 flex items-center"
            aria-hidden="true"
          >
            <Icon icon={ChevronDown} size="sm" />
          </span>
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
Select.displayName = 'Select'

