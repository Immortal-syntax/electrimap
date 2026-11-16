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
import type { LayerSourceClass } from '../map/symbology'
import { LayerSourceBadge } from './Badge'
import { Icon } from './Icon'
import { QualityTag, type QualityTagKind } from './QualityTag'

export type StatTileTone = 'default' | 'accent' | 'ok' | 'warn' | 'error'

export interface StatTileProps {
  label: string
  value: string | number
  unit?: string
  quality: QualityTagKind
  subtitle?: React.ReactNode
  source?: LayerSourceClass
  icon?: LucideIcon
  tone?: StatTileTone
  className?: string
}

const TONE_TOP_BORDER: Record<StatTileTone, string> = {
  default: 'border-rule/80',
  accent: 'border-accent-border/80 bg-gradient-to-b from-accent-tint/25 to-sheet',
  ok: 'border-ok-border/80 bg-gradient-to-b from-ok-bg/35 to-sheet',
  warn: 'border-warn-border/80 bg-gradient-to-b from-warn-bg/40 to-sheet',
  error: 'border-error-border/80 bg-gradient-to-b from-error-bg/35 to-sheet',
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  unit,
  quality,
  subtitle,
  source,
  icon,
  tone = 'default',
  className = '',
}) => {
  return (
    <div
      className={`bg-sheet border ${TONE_TOP_BORDER[tone]} rounded-md p-5 flex flex-col justify-between gap-2.5 shadow-card ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <Icon icon={icon} size="sm" className="text-accent shrink-0" />}
          <span className="text-xs font-semibold text-ink-2">{label}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {source && <LayerSourceBadge source={source} />}
          <QualityTag kind={quality} />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 flex-wrap mt-0.5 min-w-0">
        <span className="text-2xl font-bold tracking-tight tabular-nums text-ink max-w-full break-words">
          {value}
        </span>
        {unit && <span className="text-xs font-sans font-medium text-ink-3 break-words">{unit}</span>}
      </div>
      {subtitle && (
        <div className="text-xs text-ink-3 leading-relaxed">{subtitle}</div>
      )}
    </div>
  )
}
