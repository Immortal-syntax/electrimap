/*
 * Copyright 2026 Swayam Kumar
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';

export type QualityTagKind =
  | 'VERIFIED'
  | 'ESTIMATED'
  | 'ASSUMED'
  | 'PROXY'
  | 'USER_ENTERED';

export interface QualityTagProps {
  kind: QualityTagKind;
  label?: string;
  className?: string;
}

const TAG_META: Record<
  QualityTagKind,
  { defaultLabel: string; styleClass: string; prefixGlyph: string; title: string }
> = {
  VERIFIED: {
    defaultLabel: 'VERIFIED',
    styleClass: 'border border-solid border-ink bg-sheet text-ink font-semibold',
    prefixGlyph: '✓ ',
    title: 'Ground or utility verified data',
  },
  ESTIMATED: {
    defaultLabel: 'ESTIMATED',
    styleClass: 'border border-dashed border-ink-2 bg-paper text-ink-2',
    prefixGlyph: '≈ ',
    title: 'Engineering or remote-sensing estimate — requires field verification',
  },
  ASSUMED: {
    defaultLabel: 'ASSUMED',
    styleClass: 'border border-dashed border-warn bg-warn-bg text-warn italic',
    prefixGlyph: '△ ',
    title: 'Explicit planning assumption — must be confirmed on ground',
  },
  PROXY: {
    defaultLabel: 'PROXY',
    styleClass: 'border border-dotted border-ink-2 bg-paper text-ink-2',
    prefixGlyph: '◌ ',
    title: 'Satellite / night-time lights proxy — cannot detect household meters',
  },
  USER_ENTERED: {
    defaultLabel: 'USER ENTERED',
    styleClass: 'border border-solid border-accent bg-accent-tint text-accent',
    prefixGlyph: '✎ ',
    title: 'Entered or edited by planner in this session',
  },
};

export const QualityTag: React.FC<QualityTagProps> = ({ kind, label, className = '' }) => {
  const meta = TAG_META[kind];
  return (
    <span
      title={meta.title}
      data-quality-kind={kind}
      className={`inline-flex items-center px-1.5 py-0.5 text-[11px] leading-tight tracking-wide font-mono rounded-xs select-none ${meta.styleClass} ${className}`}
    >
      <span aria-hidden="true" className="mr-0.5">
        {meta.prefixGlyph}
      </span>
      {label ?? meta.defaultLabel}
    </span>
  );
};

