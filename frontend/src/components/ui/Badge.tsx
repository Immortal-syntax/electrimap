import React from 'react';

export type ProxyElectrificationClass =
  | 'LIKELY_ELECTRIFIED'
  | 'POTENTIALLY_UNDERSERVED'
  | 'POTENTIALLY_UNSERVED'
  | 'UNKNOWN';

export type VerificationState = 'UNVERIFIED' | 'FIELD_VERIFIED' | 'UTILITY_VERIFIED';

export interface ClassificationBadgeProps {
  proxyClass: ProxyElectrificationClass;
  verificationState?: VerificationState;
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
};

export const ClassificationBadge: React.FC<ClassificationBadgeProps> = ({
  proxyClass,
  verificationState = 'UNVERIFIED',
}) => {
  const meta = CLASS_META[proxyClass];
  const isVerified = verificationState !== 'UNVERIFIED';

  return (
    <span
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
      <span className="text-[10px] font-mono text-ink-2 border-l border-rule pl-1">
        {isVerified ? `✓ ${verificationState.replace('_', ' ')}` : 'PROXY · UNVERIFIED'}
      </span>
    </span>
  );
};

