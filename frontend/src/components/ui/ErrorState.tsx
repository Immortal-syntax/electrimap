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
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from './Button'
import { Icon } from './Icon'

export interface ErrorStateProps {
  title?: React.ReactNode
  message: React.ReactNode
  errorCode?: string
  onRetry?: () => void
  retryLabel?: string
  actions?: React.ReactNode
  compact?: boolean
  className?: string
}

export function ErrorState({
  title = 'Operation failed',
  message,
  errorCode,
  onRetry,
  retryLabel = 'Retry operation',
  actions,
  compact = false,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`bg-error-bg border border-error-border border-l-4 border-l-error rounded-sm ${
        compact ? 'p-3.5' : 'p-5'
      } flex flex-col gap-2.5 ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <Icon icon={AlertTriangle} size="md" className="text-error mt-0.5 shrink-0" />
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-error">
                {title}
              </h3>
              {errorCode && (
                <span className="px-1.5 py-0.5 text-2xs font-mono bg-sheet border border-error-border text-error rounded-xs">
                  {errorCode}
                </span>
              )}
            </div>
            <div className="text-xs text-ink leading-relaxed">{message}</div>
          </div>
        </div>

        {(onRetry || actions) && (
          <div className="flex items-center gap-2 shrink-0">
            {onRetry && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={RotateCcw}
                onClick={onRetry}
              >
                {retryLabel}
              </Button>
            )}
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

