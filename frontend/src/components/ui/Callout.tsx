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

