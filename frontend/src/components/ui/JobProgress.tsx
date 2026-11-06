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
import { Button } from './Button';

export interface JobStatusDto {
  id: string;
  project_id: string | null;
  job_type: string;
  status: string;
  progress: number;
  stage: string | null;
  params: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  attempts: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export interface JobProgressProps {
  job: JobStatusDto;
  onCancel?: (jobId: string) => void;
}

export const JobProgress: React.FC<JobProgressProps> = ({ job, onCancel }) => {
  const isActive = job.status === 'PENDING' || job.status === 'RUNNING';
  const isFailed = job.status === 'FAILED';
  const isCancelled = job.status === 'CANCELLED';
  const isSucceeded = job.status === 'SUCCEEDED';

  const barColor = isFailed
    ? 'bg-error'
    : isCancelled
      ? 'bg-warn'
      : isSucceeded
        ? 'bg-ok'
        : 'bg-accent';

  return (
    <div
      role="status"
      aria-live="polite"
      className="p-2.5 bg-sheet border border-rule-strong rounded-xs space-y-1.5 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-ink uppercase">{job.job_type}</span>
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded-xs border ${
              isSucceeded
                ? 'border-ok text-ok bg-ok/10'
                : isFailed
                  ? 'border-error text-error bg-error/10'
                  : isCancelled
                    ? 'border-warn text-warn bg-warn/10'
                    : 'border-accent text-accent bg-accent-tint'
            }`}
          >
            {job.status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-ink-2">{job.progress}%</span>
          {isActive && onCancel && (
            <Button size="sm" variant="secondary" onClick={() => onCancel(job.id)}>
              Cancel Job
            </Button>
          )}
        </div>
      </div>

      <div className="w-full h-1.5 bg-paper border border-rule rounded-xs overflow-hidden">
        <div
          className={`h-full transition-all duration-200 ${barColor}`}
          style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }}
        />
      </div>

      {job.stage && <div className="font-mono text-[11px] text-ink-2">{job.stage}</div>}

      {isFailed && job.error && (
        <div className="font-mono text-[11px] text-error">[JOB_ERROR] {job.error}</div>
      )}
    </div>
  );
};
