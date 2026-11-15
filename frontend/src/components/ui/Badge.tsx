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
import { LAYER_SOURCE_META, type LayerSourceClass } from '../map/symbology'

export type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'navy'
  | 'ok'
  | 'warn'
  | 'error'
  | 'info'

export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  mono?: boolean
  dashed?: boolean
  dot?: boolean
}

const BADGE_VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-subtle text-ink-2 border-rule',
  primary: 'bg-accent-tint text-accent border-accent-border',
  navy: 'bg-navy-900 text-white border-navy-950',
  ok: 'bg-ok-bg text-ok border-ok-border',
  warn: 'bg-warn-bg text-warn border-warn-border',
  error: 'bg-error-bg text-error border-error-border',
  info: 'bg-info-bg text-info border-info-border',
}

const BADGE_DOT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-ink-3',
  primary: 'bg-accent',
  navy: 'bg-sky-400',
  ok: 'bg-ok',
  warn: 'bg-warn',
  error: 'bg-error',
  info: 'bg-info',
}

const BADGE_SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-2xs gap-1',
  md: 'px-2 py-0.5 text-xs gap-1.5',
}

export function Badge({
  variant = 'neutral',
  size = 'sm',
  mono = false,
  dashed = false,
  dot = false,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap shrink-0 rounded-xs border font-medium leading-none select-none ${
        dashed ? 'border-dashed' : 'border-solid'
      } ${BADGE_VARIANT_CLASSES[variant]} ${BADGE_SIZE_CLASSES[size]} ${
        mono ? 'font-mono tracking-tight' : 'font-sans'
      } ${className}`.trim()}
      {...rest}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${BADGE_DOT_CLASSES[variant]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

export interface LayerSourceBadgeProps {
  source: LayerSourceClass
  className?: string
}

const SOURCE_VARIANT_MAP: Record<
  LayerSourceClass,
  { variant: BadgeVariant; dashed: boolean }
> = {
  PROJECT: { variant: 'primary', dashed: false },
  REFERENCE_DEMO: { variant: 'warn', dashed: true },
  SYNTHETIC_PLACEHOLDER: { variant: 'error', dashed: true },
  EXTERNAL_TILES: { variant: 'neutral', dashed: false },
}

export function LayerSourceBadge({
  source,
  className = '',
}: LayerSourceBadgeProps) {
  const meta = LAYER_SOURCE_META[source]
  const style = SOURCE_VARIANT_MAP[source]
  return (
    <Badge
      variant={style.variant}
      dashed={style.dashed}
      size="sm"
      mono
      title={`${meta.fullLabel}: ${meta.description}`}
      data-layer-source={source}
      className={className}
    >
      {meta.shortLabel}
    </Badge>
  )
}

export type ProxyElectrificationClass =
  | 'LIKELY_ELECTRIFIED'
  | 'POTENTIALLY_UNDERSERVED'
  | 'POTENTIALLY_UNSERVED'
  | 'UNKNOWN'

export type VerificationState =
  | 'UNVERIFIED'
  | 'FIELD_VERIFIED'
  | 'UTILITY_VERIFIED'

export interface ClassificationBadgeProps {
  proxyClass: ProxyElectrificationClass
  verificationState?: VerificationState
}

const CLASS_META: Record<
  ProxyElectrificationClass,
  { label: string; colorVar: string; patternSymbol: string }
> = {
  LIKELY_ELECTRIFIED: {
    label: 'Likely Electrified',
    colorVar: 'var(--gis-likely-electrified)',
    patternSymbol: '■',
  },
  POTENTIALLY_UNDERSERVED: {
    label: 'Potentially Underserved',
    colorVar: 'var(--gis-potentially-underserved)',
    patternSymbol: '▨',
  },
  POTENTIALLY_UNSERVED: {
    label: 'Potentially Unserved',
    colorVar: 'var(--gis-potentially-unserved)',
    patternSymbol: '▩',
  },
  UNKNOWN: {
    label: 'Unknown / Insufficient Proxy',
    colorVar: 'var(--gis-unknown)',
    patternSymbol: '[::]',
  },
}

export const ClassificationBadge: React.FC<ClassificationBadgeProps> = ({
  proxyClass,
  verificationState = 'UNVERIFIED',
}) => {
  const meta = CLASS_META[proxyClass] ?? CLASS_META.UNKNOWN
  const isVerified = verificationState !== 'UNVERIFIED'

  return (
    <span
      data-proxy-class={proxyClass}
      data-verification-state={verificationState}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-xs bg-sheet text-ink ${
        isVerified ? 'border-2 border-solid' : 'border border-dashed'
      }`}
      style={{ borderColor: meta.colorVar }}
    >
      <span
        aria-hidden="true"
        className="font-mono text-[11px]"
        style={{ color: meta.colorVar }}
      >
        {meta.patternSymbol}
      </span>
      <span>{meta.label}</span>
      <span className="text-xs font-medium text-ink-2 border-l border-rule pl-1.5">
        {isVerified
          ? `✓ ${verificationState.replace('_', ' ')}`
          : 'PROXY · UNVERIFIED'}
      </span>
    </span>
  )
}
