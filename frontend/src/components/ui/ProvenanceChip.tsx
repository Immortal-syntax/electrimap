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

import React, { useState } from 'react';

export interface DatasetProvenanceDto {
  id: string;
  key: string;
  name: string;
  provider: string;
  url: string;
  licence: string;
  licence_url: string | null;
  attribution_text: string;
  spatial_resolution: string;
  temporal_coverage: string;
  version: string;
  is_non_commercial: boolean;
  notes: string | null;
}

export interface ProvenanceChipProps {
  dataset: DatasetProvenanceDto | null;
  cacheKey?: string | null;
}

export const ProvenanceChip: React.FC<ProvenanceChipProps> = ({ dataset, cacheKey }) => {
  const [expanded, setExpanded] = useState(false);

  if (!dataset) {
    return (
      <div className="text-[11px] font-mono text-ink-2 border border-rule rounded-xs bg-paper/70 px-2 py-1">
        Provenance: Custom User Upload (USER_ENTERED)
      </div>
    );
  }

  const originLabel = cacheKey?.includes('user_upload')
    ? 'USER_ENTERED'
    : 'REFERENCE_PACK';

  return (
    <div className="text-[11px] border border-rule rounded-xs bg-paper/70 px-2 py-1 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-ink-2">
          <span className="font-semibold text-ink">{dataset.provider}</span>
          <span>·</span>
          <span>{dataset.licence}</span>
          <span>·</span>
          <span>{dataset.spatial_resolution}</span>
          <span>·</span>
          <span>{dataset.temporal_coverage}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] px-1 py-0.5 border border-rule bg-sheet rounded-xs text-ink-2">
            {originLabel}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="font-mono text-[10px] text-accent underline hover:text-accent/80"
          >
            {expanded ? 'Hide attribution' : 'Attribution'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="pt-1 border-t border-rule/70 text-[11px] text-ink-2 space-y-0.5">
          <div>
            <strong className="text-ink">Dataset:</strong> {dataset.name} ({dataset.version})
          </div>
          <div>
            <strong className="text-ink">Attribution:</strong> {dataset.attribution_text}
          </div>
          {dataset.notes && (
            <div className="text-warn">
              <strong>Caveat:</strong> {dataset.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
