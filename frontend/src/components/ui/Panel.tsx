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
import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon'

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  overline?: string
  title?: React.ReactNode
  subtitle?: React.ReactNode
  icon?: LucideIcon
  badge?: React.ReactNode
  actions?: React.ReactNode
  footer?: React.ReactNode
  noPadding?: boolean
  headerTone?: 'default' | 'subtle' | 'navy'
  as?: 'section' | 'div' | 'article' | 'aside'
}

const HEADER_TONE_CLASSES: Record<NonNullable<PanelProps['headerTone']>, string> = {
  default: 'bg-sheet border-b border-rule text-ink',
  subtle: 'bg-subtle border-b border-rule text-ink',
  navy: 'bg-navy-900 border-b border-navy-950 text-ink-inverse',
}

export function Panel({
  overline,
  title,
  subtitle,
  icon,
  badge,
  actions,
  footer,
  noPadding = false,
  headerTone = 'subtle',
  as: Component = 'section',
  className = '',
  children,
  ...rest
}: PanelProps) {
  const hasHeader = Boolean(overline || title || subtitle || badge || actions)
  const isNavy = headerTone === 'navy'

  return (
    <Component
      className={`bg-sheet border border-rule/80 rounded-md shadow-card overflow-hidden flex flex-col ${className}`.trim()}
      {...rest}
    >
      {hasHeader && (
        <header
          className={`px-4 sm:px-5 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${HEADER_TONE_CLASSES[headerTone]}`}
        >
          <div className="min-w-0 flex-1">
            {overline && (
              <div
                className={`text-xs font-medium mb-0.5 ${isNavy ? 'text-slate-300' : 'text-ink-3'}`}
              >
                {overline}
              </div>
            )}
            <div className="flex items-start gap-2">
              {icon && (
                <Icon
                  icon={icon}
                  size="sm"
                  className={`mt-1 shrink-0 ${isNavy ? 'text-sky-400' : 'text-accent'}`}
                />
              )}
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {title && (
                  <h3
                    className={`text-base font-semibold tracking-tight ${isNavy ? 'text-white' : 'text-ink'}`}
                  >
                    {title}
                  </h3>
                )}
                {badge}
              </div>
            </div>
            {subtitle && (
              <p
                className={`text-xs mt-1 leading-relaxed ${isNavy ? 'text-slate-300' : 'text-ink-2'}`}
              >
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 lg:shrink-0 max-w-full">{actions}</div>}
        </header>
      )}
      <div className={noPadding ? 'flex-1' : 'p-4 flex-1'}>{children}</div>
      {footer && (
        <footer className="px-4 py-2.5 bg-subtle border-t border-rule text-xs text-ink-2 flex items-center justify-between gap-2">
          {footer}
        </footer>
      )}
    </Component>
  )
}

export interface PageHeaderProps {
  overline?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  overline,
  title,
  subtitle,
  meta,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-rule-subtle ${className}`.trim()}
    >
      <div className="space-y-1.5 min-w-0">
        {overline && <div className="heading-overline">{overline}</div>}
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="heading-xl">{title}</h1>
          {meta}
        </div>
        {subtitle && <p className="text-sm text-ink-2 max-w-3xl leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0 flex-wrap">{actions}</div>}
    </div>
  )
}

