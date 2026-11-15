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

export interface TitleBlockProps {
  sheetNumber?: string
  projectTitle: string
  villageLabel: string
  blockAndDistrict: string
  crsLabel: string
  scenarioName: string
  dateIso: string
  isPreliminary?: boolean
}

export const TitleBlock: React.FC<TitleBlockProps> = ({
  sheetNumber = 'SHEET DPR-M0-01',
  projectTitle,
  villageLabel,
  blockAndDistrict,
  crsLabel,
  scenarioName,
  dateIso,
  isPreliminary = true,
}) => {
  return (
    <header
      aria-label="Engineering Survey Drawing Title Block"
      className="bg-sheet border border-rule rounded-sm shadow-xs grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-rule text-body-sm overflow-hidden"
    >
      <div className="lg:col-span-5 p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-ink-3 font-medium">
            {sheetNumber} · ElectriMap DPR Workbench
          </span>
          {isPreliminary && (
            <span className="px-2 py-0.5 text-xs font-medium border border-dashed border-warn-border bg-warn-bg text-warn rounded-xs">
              PRELIMINARY — NOT FIELD VERIFIED
            </span>
          )}
        </div>
        <h1 className="text-xl font-semibold text-ink mt-1.5 tracking-tight">
          {projectTitle}
        </h1>
        <p className="text-ink-2 text-xs mt-1">
          GIS &amp; Satellite-Based Pre-Feasibility Assessment for Rural &amp; Tribal Electrification
        </p>
      </div>

      <div className="lg:col-span-4 p-4 grid grid-cols-2 gap-3 bg-subtle/40 text-xs">
        <div>
          <div className="small-caps-heading">Habitation / Village</div>
          <div className="font-medium text-ink mt-0.5 text-body-sm">{villageLabel}</div>
        </div>
        <div>
          <div className="small-caps-heading">Block &amp; District</div>
          <div className="font-medium text-ink mt-0.5 text-body-sm">{blockAndDistrict}</div>
        </div>
        <div>
          <div className="small-caps-heading">Metric Projection</div>
          <div className="font-mono text-ink mt-0.5 text-xs">{crsLabel}</div>
        </div>
        <div>
          <div className="small-caps-heading">Active Scenario</div>
          <div className="font-medium text-accent mt-0.5 text-body-sm">{scenarioName}</div>
        </div>
      </div>

      <div className="lg:col-span-3 p-4 flex flex-col justify-between bg-sheet">
        <div className="flex items-center justify-between">
          <span className="small-caps-heading">Epistemic Policy</span>
          <span className="font-mono text-xs text-ink-3">{dateIso}</span>
        </div>
        <p className="text-xs leading-relaxed text-ink-2 mt-1.5">
          Remote sensing proxies cannot observe household electricity meters. Ground survey &amp;
          DISCOM asset confirmation required prior to tendering.
        </p>
      </div>
    </header>
  )
}
