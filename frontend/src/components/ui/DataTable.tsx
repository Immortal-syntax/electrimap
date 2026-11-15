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

export type ColumnAlign = 'left' | 'right' | 'center'

export interface DataTableColumn<T> {
  /** Unique column identifier */
  key: string
  /** Column header label (include explicit units, e.g., "Length (m)") */
  header: React.ReactNode
  /** Horizontal alignment; defaults to 'right' when mono=true, else 'left' */
  align?: ColumnAlign
  /** Render cell in tabular monospace font */
  mono?: boolean
  /** Optional CSS width class (e.g., "w-28") */
  widthClassName?: string
  /** Custom cell renderer */
  render: (row: T, index: number) => React.ReactNode
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  rowKey: (row: T, index: number) => string | number
  caption?: string
  emptyMessage?: React.ReactNode
  selectedRowKey?: string | number | null
  onRowClick?: (row: T, index: number) => void
  footer?: React.ReactNode
  compact?: boolean
  stickyHeader?: boolean
  maxHeightClassName?: string
  className?: string
}

const ALIGN_CLASSES: Record<ColumnAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  caption,
  emptyMessage = 'No records available.',
  selectedRowKey,
  onRowClick,
  footer,
  compact = false,
  stickyHeader = false,
  maxHeightClassName = '',
  className = '',
}: DataTableProps<T>) {
  const cellPad = compact ? 'px-3 py-2' : 'px-4 py-3'

  return (
    <div
      className={`table-scroll-container ${maxHeightClassName ? `${maxHeightClassName} overflow-y-auto` : ''} ${className}`.trim()}
    >
      <table className="w-full text-xs border-collapse">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead
          className={`bg-subtle/75 border-b border-rule text-ink-2 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}
        >
          <tr>
            {columns.map((col) => {
              const align = col.align ?? (col.mono ? 'right' : 'left')
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={`${cellPad} font-semibold text-xs select-none ${ALIGN_CLASSES[align]} ${col.widthClassName ?? ''}`.trim()}
                >
                  {col.header}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule-subtle bg-sheet">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-xs text-ink-3"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => {
              const key = rowKey(row, idx)
              const isSelected = selectedRowKey !== undefined && selectedRowKey === key
              const isInteractive = Boolean(onRowClick)
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
                  tabIndex={isInteractive ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRowClick(row, idx)
                          }
                        }
                      : undefined
                  }
                  aria-selected={isSelected || undefined}
                  className={`transition-colors ${
                    isSelected
                      ? 'bg-accent-tint/60 font-medium'
                      : 'hover:bg-surface-hover'
                  } ${isInteractive ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus' : ''}`.trim()}
                >
                  {columns.map((col) => {
                    const align = col.align ?? (col.mono ? 'right' : 'left')
                    return (
                      <td
                        key={col.key}
                        className={`${cellPad} text-ink ${ALIGN_CLASSES[align]} ${
                          col.mono ? 'font-mono tabular-nums' : 'font-sans'
                        } ${col.widthClassName ?? ''}`.trim()}
                      >
                        {col.render(row, idx)}
                      </td>
                    )
                  })}
                </tr>
              )
            })
          )}
        </tbody>
        {footer && (
          <tfoot className="bg-subtle border-t border-rule font-semibold text-ink">
            {footer}
          </tfoot>
        )}
      </table>
    </div>
  )
}

/* Composable Low-Level Table Primitives for Complex / Multi-Header Engineering Tables */

export function TableContainer({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`table-scroll-container ${className}`.trim()} {...rest}>
      {children}
    </div>
  )
}

export function Table({
  className = '',
  children,
  ...rest
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={`w-full text-xs border-collapse ${className}`.trim()} {...rest}>
      {children}
    </table>
  )
}

export function TableHead({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`bg-subtle border-b border-rule text-ink-2 ${className}`.trim()}
      {...rest}
    >
      {children}
    </thead>
  )
}

export function TableBody({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={`divide-y divide-rule-subtle bg-sheet ${className}`.trim()}
      {...rest}
    >
      {children}
    </tbody>
  )
}

export function TableFoot({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={`bg-subtle border-t border-rule font-semibold text-ink ${className}`.trim()}
      {...rest}
    >
      {children}
    </tfoot>
  )
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  isSelected?: boolean
}

export function TableRow({
  isSelected = false,
  className = '',
  children,
  ...rest
}: TableRowProps) {
  return (
    <tr
      aria-selected={isSelected || undefined}
      className={`transition-colors ${
        isSelected ? 'bg-accent-tint/60' : 'hover:bg-surface-hover'
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </tr>
  )
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: ColumnAlign
  mono?: boolean
  compact?: boolean
}

export function TableHeaderCell({
  align = 'left',
  compact = false,
  className = '',
  children,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  align?: ColumnAlign
  compact?: boolean
}) {
  return (
    <th
      scope="col"
      className={`${compact ? 'px-3 py-2' : 'px-4 py-3'} font-semibold text-xs text-ink-2 ${ALIGN_CLASSES[align]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </th>
  )
}

export function TableCell({
  align = 'left',
  mono = false,
  compact = false,
  className = '',
  children,
  ...rest
}: TableCellProps) {
  return (
    <td
      className={`${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} text-ink ${ALIGN_CLASSES[align]} ${
        mono ? 'font-mono tabular-nums' : 'font-sans'
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </td>
  )
}

