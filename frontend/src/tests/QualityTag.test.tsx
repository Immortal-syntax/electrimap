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

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QualityTag } from '../components/ui/QualityTag';
import { ClassificationBadge } from '../components/ui/Badge';
import { TitleBlock } from '../components/ui/TitleBlock';

describe('Survey Sheet Epistemic & Provenance Primitives', () => {
  it('distinguishes VERIFIED (solid border + checkmark) from ESTIMATED (dashed border)', () => {
    const { rerender } = render(<QualityTag kind="VERIFIED" />);
    const verifiedEl = screen.getByText(/VERIFIED/i);
    expect(verifiedEl).toHaveAttribute('data-quality-kind', 'VERIFIED');
    expect(verifiedEl.className).toContain('border-solid');

    rerender(<QualityTag kind="ESTIMATED" />);
    const estimatedEl = screen.getByText(/ESTIMATED/i);
    expect(estimatedEl).toHaveAttribute('data-quality-kind', 'ESTIMATED');
    expect(estimatedEl.className).toContain('border-dashed');
  });

  it('renders two-axis ClassificationBadge with explicit UNVERIFIED vs FIELD_VERIFIED state', () => {
    const { rerender } = render(
      <ClassificationBadge
        proxyClass="POTENTIALLY_UNSERVED"
        verificationState="UNVERIFIED"
      />,
    );
    expect(screen.getByText('Potentially Unserved')).toBeInTheDocument();
    expect(screen.getByText('PROXY · UNVERIFIED')).toBeInTheDocument();

    rerender(
      <ClassificationBadge
        proxyClass="POTENTIALLY_UNSERVED"
        verificationState="FIELD_VERIFIED"
      />,
    );
    expect(screen.getByText(/FIELD VERIFIED/i)).toBeInTheDocument();
  });

  it('renders TitleBlock with mandatory PRELIMINARY — NOT FIELD VERIFIED stamp', () => {
    render(
      <TitleBlock
        projectTitle="Nandapur Tribal Electrification Study"
        villageLabel="Bheja (LGD 398712)"
        blockAndDistrict="Nandapur, Koraput"
        crsLabel="EPSG:32644"
        scenarioName="SC-01"
        dateIso="2026-11-06"
        isPreliminary={true}
      />,
    );
    expect(
      screen.getByText('PRELIMINARY — NOT FIELD VERIFIED'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Nandapur Tribal Electrification Study'),
    ).toBeInTheDocument();
  });
});

