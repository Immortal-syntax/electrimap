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

export type CalloutTone = 'info' | 'warn' | 'error' | 'ok';

export interface CalloutProps {
  tone: CalloutTone;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

const TONE_STYLES: Record<CalloutTone, { border: string; bg: string; titleColor: string }> = {
  info: {
    border: 'border-l-4 border-l-info border-rule',
    bg: 'bg-info-bg/50',
    titleColor: 'text-info',
  },
  warn: {
    border: 'border-l-4 border-l-warn border-rule',
    bg: 'bg-warn-bg/70',
    titleColor: 'text-warn',
  },
  error: {
    border: 'border-l-4 border-l-error border-rule',
    bg: 'bg-error-bg/70',
    titleColor: 'text-error',
  },
  ok: {
    border: 'border-l-4 border-l-ok border-rule',
    bg: 'bg-sheet',
    titleColor: 'text-ok',
  },
};

export const Callout: React.FC<CalloutProps> = ({ tone, title, children, action }) => {
  const style = TONE_STYLES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'region'}
      aria-label={title}
      className={`border rounded-xs p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${style.border} ${style.bg}`}
    >
      <div className="space-y-1">
        <div className={`text-xs font-semibold uppercase tracking-wider ${style.titleColor}`}>
          {title}
        </div>
        <div className="text-xs text-ink leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

