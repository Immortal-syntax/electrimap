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
  Activity,
  AlertTriangle,
  Ban,
  Check,
  Pencil,
  Radio,
  type LucideIcon,
} from 'lucide-react'

export type QualityTagKind =
  | 'VERIFIED'
  | 'ESTIMATED'
  | 'ASSUMED'
  | 'PROXY'
  | 'USER_ENTERED'
  | 'UNSET'

export interface QualityTagProps {
  kind: QualityTagKind
  label?: string
  className?: string
}

const TAG_META: Record<
  QualityTagKind,
  { defaultLabel: string; styleClass: string; Icon: LucideIcon; title: string }
> = {
  VERIFIED: {
    defaultLabel: 'VERIFIED',
    styleClass: 'border border-solid border-ok-border bg-ok-bg text-ok font-semibold',
    Icon: Check,
    title: 'Ground or utility verified data',
  },
  ESTIMATED: {
    defaultLabel: 'ESTIMATED',
    styleClass: 'border border-dashed border-rule-strong bg-subtle text-ink-2',
    Icon: Activity,
    title: 'Engineering or remote-sensing estimate — requires field verification',
  },
  ASSUMED: {
    defaultLabel: 'ASSUMED',
    styleClass: 'border border-dashed border-warn-border bg-warn-bg text-warn italic',
    Icon: AlertTriangle,
    title: 'Explicit planning assumption — must be confirmed on ground',
  },
  PROXY: {
    defaultLabel: 'PROXY',
    styleClass: 'border border-dotted border-rule-strong bg-subtle text-ink-2',
    Icon: Radio,
    title: 'Satellite / night-time lights proxy — cannot detect household meters',
  },
  USER_ENTERED: {
    defaultLabel: 'USER ENTERED',
    styleClass: 'border border-solid border-accent-border bg-accent-tint text-accent',
    Icon: Pencil,
    title: 'Entered or edited by planner in this session',
  },
  UNSET: {
    defaultLabel: 'UNSET',
    styleClass: 'border border-dotted border-error-border bg-error-bg text-error',
    Icon: Ban,
    title: 'Parameter not yet configured — blocks DPR export',
  },
}

export const QualityTag: React.FC<QualityTagProps> = ({
  kind,
  label,
  className = '',
}) => {
  const meta = TAG_META[kind] ?? TAG_META.ESTIMATED
  const Icon = meta.Icon
  const displayLabel = label ?? meta.defaultLabel
  return (
    <span
      title={meta.title}
      aria-label={`${displayLabel} — ${meta.title}`}
      data-quality-kind={kind}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-2xs leading-tight tracking-wide font-sans font-medium whitespace-nowrap shrink-0 rounded-full select-none ${meta.styleClass} ${className}`.trim()}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {displayLabel}
    </span>
  )
}
