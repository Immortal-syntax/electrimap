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
import { Loader2 } from 'lucide-react'
import { Icon, type IconSize } from './Icon'

export interface SpinnerProps {
  size?: IconSize
  label?: string
  decorative?: boolean
  className?: string
}

export function Spinner({
  size = 'md',
  label = 'Loading',
  decorative = false,
  className = '',
}: SpinnerProps) {
  if (decorative) {
    return (
      <span aria-hidden="true" className={`inline-flex items-center text-accent ${className}`.trim()}>
        <Icon icon={Loader2} size={size} className="animate-spin" />
      </span>
    )
  }

  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex items-center gap-2 text-accent ${className}`.trim()}
    >
      <Icon icon={Loader2} size={size} className="animate-spin" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  widthClassName?: string
  heightClassName?: string
}

export function Skeleton({
  widthClassName = 'w-full',
  heightClassName = 'h-4',
  className = '',
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xs bg-rule-subtle border border-rule/40 ${widthClassName} ${heightClassName} ${className}`.trim()}
      {...rest}
    />
  )
}

export interface TableSkeletonProps {
  rows?: number
  columns?: number
  className?: string
}

export function TableSkeleton({
  rows = 4,
  columns = 5,
  className = '',
}: TableSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading tabular data"
      className={`border border-rule rounded-sm bg-sheet overflow-hidden ${className}`.trim()}
    >
      <div className="bg-subtle border-b border-rule px-3 py-2 grid grid-cols-5 gap-3">
        {Array.from({ length: columns }).map((_, idx) => (
          <Skeleton key={idx} heightClassName="h-3" widthClassName="w-3/4" />
        ))}
      </div>
      <div className="divide-y divide-rule-subtle">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="px-3 py-2.5 grid grid-cols-5 gap-3">
            {Array.from({ length: columns }).map((__, colIdx) => (
              <Skeleton
                key={colIdx}
                heightClassName="h-3.5"
                widthClassName={colIdx === 0 ? 'w-5/6' : 'w-2/3'}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading table rows...</span>
    </div>
  )
}

export interface LoadingStateProps {
  title?: string
  description?: string
  compact?: boolean
  className?: string
}

export function LoadingState({
  title = 'Loading workbench data…',
  description,
  compact = false,
  className = '',
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`bg-sheet border border-rule rounded-sm flex flex-col items-center justify-center text-center ${
        compact ? 'p-4 gap-1.5' : 'p-8 gap-2.5'
      } ${className}`.trim()}
    >
      <Spinner size={compact ? 'md' : 'lg'} decorative />
      <div className="text-xs font-semibold text-ink">{title}</div>
      {description && (
        <p className="text-2xs text-ink-3 max-w-md leading-relaxed">{description}</p>
      )}
    </div>
  )
}
