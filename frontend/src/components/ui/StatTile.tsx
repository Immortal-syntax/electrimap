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
import { QualityTag, QualityTagKind } from './QualityTag';

export interface StatTileProps {
  label: string;
  value: string | number;
  unit?: string;
  quality: QualityTagKind;
  subtitle?: string;
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  unit,
  quality,
  subtitle,
}) => {
  return (
    <div className="bg-sheet border border-rule rounded-xs p-3 flex flex-col justify-between gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="small-caps-heading">{label}</span>
        <QualityTag kind={quality} />
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-xl font-semibold font-mono tabular-mono text-ink">{value}</span>
        {unit && <span className="text-xs font-mono text-ink-2">{unit}</span>}
      </div>
      {subtitle && <div className="text-[11px] text-ink-3 leading-tight">{subtitle}</div>}
    </div>
  );
};

