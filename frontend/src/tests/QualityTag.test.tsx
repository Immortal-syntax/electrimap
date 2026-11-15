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

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Layers } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ClassificationBadge,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  KeyValueList,
  LayerSourceBadge,
  LoadingState,
  Panel,
  QualityTag,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TitleBlock,
  Tooltip,
} from '../components/ui';

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

describe('Phase 1 Design System Reusable Components', () => {
  it('renders Button and IconButton with loading, active, and icon states', () => {
    render(
      <div>
        <Button variant="primary" leftIcon={Layers} isLoading loadingText="Computing...">
          Run Solver
        </Button>
        <IconButton
          icon={Layers}
          aria-label="Toggle GIS Layers"
          isActive={true}
        />
      </div>,
    );

    const loadingBtn = screen.getByRole('button', { name: /Computing.../i });
    expect(loadingBtn).toBeDisabled();
    expect(loadingBtn).toHaveAttribute('aria-busy', 'true');

    const iconBtn = screen.getByRole('button', { name: 'Toggle GIS Layers' });
    expect(iconBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders Input with unit badge, error alert, and Select with options', () => {
    render(
      <div>
        <Input
          label="Peak Feeder Load"
          unit="kVA"
          mono
          defaultValue="63.0"
          error="Exceeds 100 kVA transformer rating"
        />
        <Select
          label="Conductor Specification"
          defaultValue="ACSR_50"
          options={[
            { value: 'ACSR_50', label: 'ACSR Rabbit 50 mm²' },
            { value: 'LT_ABC_50', label: 'LT Aerial Bunched Cable 50 mm²' },
          ]}
        />
      </div>,
    );

    const input = screen.getByLabelText('Peak Feeder Load');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Exceeds 100 kVA transformer rating',
    );
    expect(screen.getByText('kVA')).toBeInTheDocument();

    const select = screen.getByLabelText('Conductor Specification');
    expect(select).toHaveValue('ACSR_50');
  });

  it('renders Panel, Card, KeyValueList, Badge, and LayerSourceBadge', () => {
    render(
      <Panel
        overline="DISTRIBUTION NETWORK"
        title="Feeder Summary"
        badge={<LayerSourceBadge source="REFERENCE_DEMO" />}
      >
        <Card variant="subtle">
          <Badge variant="ok" dot>
            CEA VDrop OK
          </Badge>
          <KeyValueList
            items={[
              { label: '11 kV Length', value: '2,450 m', mono: true },
              { label: 'Max Voltage Drop', value: '4.12 %', mono: true },
            ]}
          />
        </Card>
      </Panel>,
    );

    expect(screen.getByText('Feeder Summary')).toBeInTheDocument();
    expect(screen.getByText('REF · DEMO')).toHaveAttribute(
      'data-layer-source',
      'REFERENCE_DEMO',
    );
    expect(screen.getByText('CEA VDrop OK')).toBeInTheDocument();
    expect(screen.getByText('2,450 m')).toBeInTheDocument();
  });

  it('renders typed DataTable and handles row selection', () => {
    const onSelect = vi.fn();
    const rows = [
      { id: 'CL-01', name: 'Bheja Main', peakKva: 42.5 },
      { id: 'CL-02', name: 'Padwa Hamlet', peakKva: 18.0 },
    ];

    render(
      <DataTable
        caption="Habitation Demand Clusters"
        data={rows}
        rowKey={(r) => r.id}
        selectedRowKey="CL-01"
        onRowClick={onSelect}
        columns={[
          { key: 'id', header: 'Cluster ID', mono: true, render: (r) => r.id },
          { key: 'name', header: 'Habitation', render: (r) => r.name },
          {
            key: 'peakKva',
            header: 'Peak Demand (kVA)',
            mono: true,
            render: (r) => r.peakKva.toFixed(1),
          },
        ]}
      />,
    );

    expect(screen.getByText('Bheja Main')).toBeInTheDocument();
    expect(screen.getByText('42.5')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Padwa Hamlet'));
    expect(onSelect).toHaveBeenCalledWith(rows[1], 1);
  });

  it('renders Tabs and switches active tab panel', () => {
    render(
      <Tabs defaultValue="sld" variant="segmented">
        <TabsList ariaLabel="Engineering Views">
          <TabsTrigger value="sld">Single-Line Diagram</TabsTrigger>
          <TabsTrigger value="boq">Bill of Quantities</TabsTrigger>
        </TabsList>
        <TabsContent value="sld">SLD Canvas Content</TabsContent>
        <TabsContent value="boq">BOQ Spreadsheet Content</TabsContent>
      </Tabs>,
    );

    expect(screen.getByText('SLD Canvas Content')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Bill of Quantities' }));
    expect(screen.getByText('BOQ Spreadsheet Content')).toBeInTheDocument();
  });

  it('renders Tooltip on focus and dismisses on Escape, and renders Dialog modal', () => {
    const onClose = vi.fn();
    render(
      <div>
        <Tooltip content="VIIRS DNB monthly composite (463m resolution)">
          <button type="button">Radiance Info</button>
        </Tooltip>
        <Dialog
          open={true}
          onClose={onClose}
          title="Confirm Rate Schedule Reset"
          description="Restores reference Schedule of Rates."
        >
          <p>All custom edits will be replaced.</p>
        </Dialog>
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'Radiance Info' });
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'VIIRS DNB monthly composite (463m resolution)',
    );
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    expect(
      screen.getByRole('dialog', { name: 'Confirm Rate Schedule Reset' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders LoadingState, EmptyState, and ErrorState with retry callback', () => {
    const onRetry = vi.fn();
    render(
      <div>
        <LoadingState title="Running DBSCAN clustering..." />
        <EmptyState
          title="No Field Survey Records"
          description="Upload a GeoJSON settlement layer to begin."
          epistemicNote="Proxy classifications remain unverified until ground survey."
        />
        <ErrorState
          title="Solver Execution Failed"
          errorCode="ERR_NO_TIE_IN"
          message="Place an assumed 11 kV tie-in point to compute feeder routing."
          onRetry={onRetry}
        />
      </div>,
    );

    expect(screen.getByText('Running DBSCAN clustering...')).toBeInTheDocument();
    expect(screen.getByText('No Field Survey Records')).toBeInTheDocument();
    expect(screen.getByText('ERR_NO_TIE_IN')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry operation/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
