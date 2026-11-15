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
import { Inbox, type LucideIcon } from 'lucide-react'
import { Icon } from './Icon'

export interface EmptyStateProps {
  icon?: LucideIcon
  overline?: string
  title: React.ReactNode
  description?: React.ReactNode
  /** Optional epistemic / engineering provenance caveat displayed in a subtle footer note */
  epistemicNote?: React.ReactNode
  action?: React.ReactNode
  compact?: boolean
  className?: string
}

export function EmptyState({
  icon = Inbox,
  overline,
  title,
  description,
  epistemicNote,
  action,
  compact = false,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`bg-sheet border border-dashed border-rule-strong rounded-lg flex flex-col items-center justify-center text-center shadow-xs ${
        compact ? 'p-6 gap-2.5' : 'p-10 gap-3.5'
      } ${className}`.trim()}
    >
      <div className="h-10 w-10 rounded-full bg-subtle border border-rule-subtle flex items-center justify-center text-ink-3">
        <Icon icon={icon} size="md" />
      </div>

      <div className="space-y-1.5 max-w-md">
        {overline && <div className="heading-overline">{overline}</div>}
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {description && (
          <p className="text-body-sm text-ink-2 leading-relaxed">{description}</p>
        )}
      </div>

      {action && <div className="pt-1 flex items-center gap-2 flex-wrap justify-center">{action}</div>}

      {epistemicNote && (
        <div className="mt-1 px-3 py-1.5 bg-subtle border border-rule-subtle rounded-xs text-xs text-ink-2 max-w-lg">
          {epistemicNote}
        </div>
      )}
    </div>
  )
}

