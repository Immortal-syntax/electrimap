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
  subtitle?: string
  source?: LayerSourceClass
  icon?: LucideIcon
  tone?: StatTileTone
  className?: string
}

const TONE_TOP_BORDER: Record<StatTileTone, string> = {
  default: 'border-t-2 border-t-navy-800',
  accent: 'border-t-2 border-t-accent',
  ok: 'border-t-2 border-t-ok',
  warn: 'border-t-2 border-t-warn',
  error: 'border-t-2 border-t-error',
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
      className={`bg-sheet border border-rule ${TONE_TOP_BORDER[tone]} rounded-sm p-4 flex flex-col justify-between gap-2 shadow-xs ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {icon && <Icon icon={icon} size="sm" className="text-ink-3 shrink-0" />}
          <span className="small-caps-heading">{label}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {source && <LayerSourceBadge source={source} />}
          <QualityTag kind={quality} />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 flex-wrap mt-0.5">
        <span className="text-xl font-semibold font-mono tabular-nums text-ink whitespace-nowrap">
          {value}
        </span>
        {unit && <span className="text-xs font-sans text-ink-2 whitespace-nowrap">{unit}</span>}
      </div>
      {subtitle && (
        <div className="text-xs text-ink-3 leading-snug">{subtitle}</div>
      )}
    </div>
  )
}
