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
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
} from 'lucide-react'
import { Icon } from './Icon'

export type CalloutTone = 'info' | 'warn' | 'error' | 'ok'

const TONE_CONFIG: Record<
  CalloutTone,
  { container: string; titleColor: string; icon: LucideIcon }
> = {
  info: {
    container: 'bg-info-bg/85 border border-info-border text-ink shadow-xs',
    titleColor: 'text-info',
    icon: Info,
  },
  warn: {
    container: 'bg-warn-bg/90 border border-warn-border text-ink shadow-xs',
    titleColor: 'text-warn',
    icon: AlertTriangle,
  },
  error: {
    container: 'bg-error-bg/90 border border-error-border text-ink shadow-xs',
    titleColor: 'text-error',
    icon: AlertCircle,
  },
  ok: {
    container: 'bg-ok-bg/90 border border-ok-border text-ink shadow-xs',
    titleColor: 'text-ok',
    icon: CheckCircle2,
  },
}

export interface CalloutProps {
  tone?: CalloutTone
  title: React.ReactNode
  children: React.ReactNode
  action?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function Callout({
  tone = 'info',
  title,
  children,
  action,
  actions,
  className = '',
}: CalloutProps) {
  const cfg = TONE_CONFIG[tone]
  const resolvedActions = action ?? actions

  return (
    <div
      role={tone === 'error' ? 'alert' : 'region'}
      aria-label={typeof title === 'string' ? title : undefined}
      className={`p-4 rounded-md text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${cfg.container} ${className}`.trim()}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span className="mt-0.5 shrink-0 p-1.5 rounded-full bg-sheet/80 border border-rule-subtle shadow-xs">
          <Icon icon={cfg.icon} size="sm" className={cfg.titleColor} />
        </span>
        <div className="space-y-1 min-w-0">
          <div className={`text-xs font-semibold tracking-tight ${cfg.titleColor}`}>
            {title}
          </div>
          <div className="text-xs text-ink-2 leading-relaxed">{children}</div>
        </div>
      </div>
      {resolvedActions && <div className="shrink-0 flex items-center gap-2">{resolvedActions}</div>}
    </div>
  )
}
