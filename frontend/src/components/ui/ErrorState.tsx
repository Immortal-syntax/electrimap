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
      className={`bg-error-bg/90 border border-error-border rounded-md shadow-xs ${
        compact ? 'p-4' : 'p-5'
      } flex flex-col gap-3 ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="p-1.5 rounded-full bg-sheet border border-error-border/70 shrink-0">
            <Icon icon={AlertTriangle} size="md" className="text-error" />
          </span>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-semibold tracking-tight text-error">
                {title}
              </h3>
              {errorCode && (
                <span className="px-2 py-0.5 text-2xs font-mono bg-sheet border border-error-border text-error rounded-full">
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

