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

export type CardVariant =
  | 'default'
  | 'subtle'
  | 'navy'
  | 'interactive'
  | 'selected'
  | 'ok'
  | 'warn'
  | 'error'

export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: CardPadding
  as?: 'div' | 'section' | 'article'
}

const CARD_VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'bg-sheet border-rule/80 text-ink shadow-card',
  subtle: 'bg-subtle/80 border-rule-subtle text-ink',
  navy: 'bg-navy-900 border-navy-800 text-ink-inverse shadow-control',
  interactive:
    'bg-sheet border-rule/80 text-ink shadow-card hover:border-accent-border hover:bg-surface-hover transition-all duration-150 cursor-pointer',
  selected: 'bg-accent-tint/60 border-accent text-ink ring-1 ring-accent shadow-card',
  ok: 'bg-ok-bg border-ok-border text-ink shadow-xs',
  warn: 'bg-warn-bg border-warn-border text-ink shadow-xs',
  error: 'bg-error-bg border-error-border text-ink shadow-xs',
}

const CARD_PADDING_CLASSES: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
}

export function Card({
  variant = 'default',
  padding = 'md',
  as: Component = 'div',
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <Component
      className={`border rounded-md ${CARD_VARIANT_CLASSES[variant]} ${CARD_PADDING_CLASSES[padding]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Component>
  )
}

export interface KeyValueItem {
  label: React.ReactNode
  value: React.ReactNode
  mono?: boolean
}

export interface KeyValueListProps {
  items: KeyValueItem[]
  columns?: 1 | 2 | 3
  dense?: boolean
  className?: string
}

export function KeyValueList({
  items,
  columns = 1,
  dense = false,
  className = '',
}: KeyValueListProps) {
  const gridClass =
    columns === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : columns === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1'

  return (
    <dl
      className={`grid ${gridClass} ${dense ? 'gap-x-4 gap-y-1.5' : 'gap-x-6 gap-y-2.5'} text-xs ${className}`.trim()}
    >
      {items.map((item, idx) => (
        <div
          key={idx}
          className="flex items-baseline justify-between gap-3 border-b border-rule-subtle pb-1.5 last:border-b-0"
        >
          <dt className="text-ink-3 font-medium shrink-0">{item.label}</dt>
          <dd
            className={`text-right text-ink ${item.mono !== false ? 'font-mono tabular-nums font-medium' : 'font-sans'}`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

